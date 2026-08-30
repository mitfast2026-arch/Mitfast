import { createAdminClient } from '@/lib/supabase/admin';
import { clearGuestCookie, peekGuestSessionId } from '@/lib/server/guest/session';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { addToCart } from '@/lib/server/cart/cart-service';
import { addToCustomerWishlist } from '@/lib/server/guest/wishlist-service';
import {
  allowUnsafeDbFallback,
  databaseMisconfiguredError,
  isRpcMissing,
} from '@/lib/server/db/production-guards';

export type MergeGuestResult = {
  mergedCartLines: number;
  mergedWishlist: number;
  failedCartLines: number;
  failedWishlist: number;
};

type ClaimedRow = {
  cart_product_id: string | null;
  cart_quantity: number | null;
  wishlist_product_id: string | null;
};

function emptyMerge(): ServerResult<MergeGuestResult> {
  return {
    success: true,
    data: {
      mergedCartLines: 0,
      mergedWishlist: 0,
      failedCartLines: 0,
      failedWishlist: 0,
    },
  };
}

async function restoreFailedGuestLines(
  admin: ReturnType<typeof createAdminClient>,
  guestSessionId: string,
  failedCart: Array<{ product_id: string; quantity: number }>,
  failedWish: Array<{ product_id: string }>
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('guest_sessions').update({ expires_at: expiresAt }).eq('id', guestSessionId);

  if (failedCart.length > 0) {
    await admin.from('guest_cart_items').upsert(
      failedCart.map((line) => ({
        guest_session_id: guestSessionId,
        product_id: line.product_id,
        quantity: line.quantity,
      })),
      { onConflict: 'guest_session_id,product_id' }
    );
  }
  if (failedWish.length > 0) {
    await admin.from('guest_wishlist_items').upsert(
      failedWish.map((line) => ({
        guest_session_id: guestSessionId,
        product_id: line.product_id,
      })),
      { onConflict: 'guest_session_id,product_id' }
    );
  }
}

async function applyClaimedLines(
  customerId: string,
  claimed: ClaimedRow[]
): Promise<{
  mergedCartLines: number;
  mergedWishlist: number;
  failedCart: Array<{ product_id: string; quantity: number }>;
  failedWish: Array<{ product_id: string }>;
}> {
  const cartLines = claimed.filter((row) => row.cart_product_id && row.cart_quantity);
  const wishLines = claimed.filter((row) => row.wishlist_product_id);

  let mergedCartLines = 0;
  let mergedWishlist = 0;
  const failedCart: Array<{ product_id: string; quantity: number }> = [];
  const failedWish: Array<{ product_id: string }> = [];

  for (const line of cartLines) {
    const result = await addToCart(customerId, line.cart_product_id as string, line.cart_quantity as number);
    if (result.success) {
      mergedCartLines += 1;
    } else {
      failedCart.push({
        product_id: line.cart_product_id as string,
        quantity: line.cart_quantity as number,
      });
    }
  }

  for (const line of wishLines) {
    const result = await addToCustomerWishlist(customerId, line.wishlist_product_id as string);
    if (result.success) {
      mergedWishlist += 1;
    } else {
      failedWish.push({ product_id: line.wishlist_product_id as string });
    }
  }

  return { mergedCartLines, mergedWishlist, failedCart, failedWish };
}

/**
 * Merges guest cart + wishlist into the authenticated customer account.
 * Claims the guest session atomically first so concurrent logins cannot double-add.
 * Fail-closed: does not clear the guest cookie if any line fails after claim.
 */
export async function mergeGuestStateIntoCustomer(
  customerId: string
): Promise<ServerResult<MergeGuestResult>> {
  try {
    const guestSessionId = await peekGuestSessionId();
    if (!guestSessionId) {
      return emptyMerge();
    }

    const admin = createAdminClient();
    const { data: claimed, error: claimError } = await (admin as any).rpc('claim_guest_session_for_merge', {
      p_guest_session_id: guestSessionId,
    });

    if (claimError) {
      if (isRpcMissing(claimError, 'claim_guest_session_for_merge')) {
        if (!allowUnsafeDbFallback()) {
          return databaseMisconfiguredError('Guest cart merge');
        }
        return mergeGuestStateLegacy(admin, customerId, guestSessionId);
      }
      return {
        success: false,
        error: {
          message: claimError.message || 'Failed to claim guest session',
          code: 'MERGE_ERROR',
        },
      };
    }

    const rows = (Array.isArray(claimed) ? claimed : claimed ? [claimed] : []) as ClaimedRow[];
    if (rows.length === 0) {
      await clearGuestCookie();
      return emptyMerge();
    }

    const applied = await applyClaimedLines(customerId, rows);
    if (applied.failedCart.length > 0 || applied.failedWish.length > 0) {
      console.error('[mergeGuestStateIntoCustomer] partial failure after claim', {
        customerId,
        mergedCartLines: applied.mergedCartLines,
        mergedWishlist: applied.mergedWishlist,
        failedCartLines: applied.failedCart.length,
        failedWishlist: applied.failedWish.length,
      });
      try {
        await restoreFailedGuestLines(admin, guestSessionId, applied.failedCart, applied.failedWish);
      } catch (restoreErr) {
        console.error('[mergeGuestStateIntoCustomer] restore failed', restoreErr);
      }
      return {
        success: false,
        error: {
          message: `Guest merge incomplete (${applied.failedCart.length} cart, ${applied.failedWish.length} wishlist failed). Guest cookie kept.`,
          code: 'MERGE_PARTIAL',
        },
      };
    }

    await clearGuestCookie();
    return {
      success: true,
      data: {
        mergedCartLines: applied.mergedCartLines,
        mergedWishlist: applied.mergedWishlist,
        failedCartLines: 0,
        failedWishlist: 0,
      },
    };
  } catch (error) {
    console.error('[mergeGuestStateIntoCustomer]', error);
    return {
      success: false,
      error: { message: 'Failed to merge guest cart', code: 'MERGE_ERROR' },
    };
  }
}

/** Dev-only fallback when claim RPC is not applied. */
async function mergeGuestStateLegacy(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  guestSessionId: string
): Promise<ServerResult<MergeGuestResult>> {
  const [{ data: guestCartRows, error: cartFetchError }, { data: guestWishRows, error: wishFetchError }] =
    await Promise.all([
      admin
        .from('guest_cart_items')
        .select('id, product_id, quantity')
        .eq('guest_session_id', guestSessionId),
      admin
        .from('guest_wishlist_items')
        .select('id, product_id')
        .eq('guest_session_id', guestSessionId),
    ]);

  if (cartFetchError || wishFetchError) {
    return {
      success: false,
      error: {
        message: cartFetchError?.message || wishFetchError?.message || 'Failed to read guest items',
        code: 'MERGE_ERROR',
      },
    };
  }

  if ((!guestCartRows || guestCartRows.length === 0) && (!guestWishRows || guestWishRows.length === 0)) {
    await clearGuestCookie();
    return emptyMerge();
  }

  const claimed: ClaimedRow[] = [
    ...(guestCartRows || []).map((line) => ({
      cart_product_id: line.product_id,
      cart_quantity: line.quantity,
      wishlist_product_id: null,
    })),
    ...(guestWishRows || []).map((line) => ({
      cart_product_id: null,
      cart_quantity: null,
      wishlist_product_id: line.product_id,
    })),
  ];

  const applied = await applyClaimedLines(customerId, claimed);

  if (applied.mergedCartLines > 0) {
    const successIds = (guestCartRows || [])
      .filter((line) => !applied.failedCart.some((f) => f.product_id === line.product_id))
      .map((line) => line.id);
    if (successIds.length > 0) {
      await admin.from('guest_cart_items').delete().in('id', successIds);
    }
  }
  if (applied.mergedWishlist > 0) {
    const successIds = (guestWishRows || [])
      .filter((line) => !applied.failedWish.some((f) => f.product_id === line.product_id))
      .map((line) => line.id);
    if (successIds.length > 0) {
      await admin.from('guest_wishlist_items').delete().in('id', successIds);
    }
  }

  if (applied.failedCart.length > 0 || applied.failedWish.length > 0) {
    return {
      success: false,
      error: {
        message: `Guest merge incomplete (${applied.failedCart.length} cart, ${applied.failedWish.length} wishlist failed). Guest cookie kept.`,
        code: 'MERGE_PARTIAL',
      },
    };
  }

  await admin
    .from('guest_sessions')
    .update({ expires_at: new Date().toISOString() })
    .eq('id', guestSessionId);
  await clearGuestCookie();
  return {
    success: true,
    data: {
      mergedCartLines: applied.mergedCartLines,
      mergedWishlist: applied.mergedWishlist,
      failedCartLines: 0,
      failedWishlist: 0,
    },
  };
}
