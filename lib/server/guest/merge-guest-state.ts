import { createAdminClient } from '@/lib/supabase/admin';
import { clearGuestCookie, peekGuestSessionId } from '@/lib/server/guest/session';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { getCustomerCart, addToCart } from '@/lib/server/cart/cart-service';
import { addToCustomerWishlist } from '@/lib/server/guest/wishlist-service';

export type MergeGuestResult = {
  mergedCartLines: number;
  mergedWishlist: number;
  failedCartLines: number;
  failedWishlist: number;
};

/**
 * Merges guest cart + wishlist into the authenticated customer account.
 * Fail-closed: does not clear the guest cookie if any line fails after claim.
 */
export async function mergeGuestStateIntoCustomer(
  customerId: string
): Promise<ServerResult<MergeGuestResult>> {
  try {
    const guestSessionId = await peekGuestSessionId();
    if (!guestSessionId) {
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

    const admin = createAdminClient();

    // 1. Fetch guest cart and wishlist rows without prematurely deleting them
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

    await getCustomerCart(customerId);

    let mergedCartLines = 0;
    let failedCartLines = 0;
    const successfulCartItemIds: string[] = [];

    for (const line of guestCartRows || []) {
      if (!line.product_id || !line.quantity) continue;
      const result = await addToCart(customerId, line.product_id, line.quantity);
      if (result.success) {
        mergedCartLines += 1;
        successfulCartItemIds.push(line.id);
      } else {
        failedCartLines += 1;
      }
    }

    let mergedWishlist = 0;
    let failedWishlist = 0;
    const successfulWishItemIds: string[] = [];

    for (const line of guestWishRows || []) {
      if (!line.product_id) continue;
      const result = await addToCustomerWishlist(customerId, line.product_id);
      if (result.success) {
        mergedWishlist += 1;
        successfulWishItemIds.push(line.id);
      } else {
        failedWishlist += 1;
      }
    }

    // 2. Delete successfully merged items so retries don't duplicate them
    if (successfulCartItemIds.length > 0) {
      await admin.from('guest_cart_items').delete().in('id', successfulCartItemIds);
    }
    if (successfulWishItemIds.length > 0) {
      await admin.from('guest_wishlist_items').delete().in('id', successfulWishItemIds);
    }

    // 3. If any item failed, keep guest cookie and remaining items
    if (failedCartLines > 0 || failedWishlist > 0) {
      console.error('[mergeGuestStateIntoCustomer] partial failure', {
        customerId,
        mergedCartLines,
        mergedWishlist,
        failedCartLines,
        failedWishlist,
      });
      return {
        success: false,
        error: {
          message: `Guest merge incomplete (${failedCartLines} cart, ${failedWishlist} wishlist failed). Guest cookie kept.`,
          code: 'MERGE_PARTIAL',
        },
      };
    }

    // 4. All items merged cleanly — expire guest session and clear cookie
    await admin
      .from('guest_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', guestSessionId);

    await clearGuestCookie();

    return {
      success: true,
      data: {
        mergedCartLines,
        mergedWishlist,
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
