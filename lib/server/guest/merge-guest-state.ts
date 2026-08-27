import { createAdminClient } from '@/lib/supabase/admin';
import { clearGuestCookie, peekGuestSessionId } from '@/lib/server/guest/session';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { getCustomerCart, addToCart } from '@/lib/server/cart/cart-service';
import { addToCustomerWishlist } from '@/lib/server/guest/wishlist-service';

/**
 * Merges guest cart + wishlist into the authenticated customer account, then clears guest state.
 * Claims guest rows atomically via DB RPC to prevent double-merge across tabs/instances.
 */
export async function mergeGuestStateIntoCustomer(
  customerId: string
): Promise<ServerResult<{ mergedCartLines: number; mergedWishlist: number }>> {
  try {
    const guestSessionId = await peekGuestSessionId();
    if (!guestSessionId) {
      return { success: true, data: { mergedCartLines: 0, mergedWishlist: 0 } };
    }

    const admin = createAdminClient();

    const { data: claimedRows, error: claimError } = await (admin as any).rpc(
      'claim_guest_session_for_merge',
      { p_guest_session_id: guestSessionId }
    );

    if (claimError) {
      return {
        success: false,
        error: { message: claimError.message, code: 'MERGE_ERROR' },
      };
    }

    await getCustomerCart(customerId);

    let mergedCartLines = 0;
    const cartLines = (claimedRows || []).filter(
      (row: { cart_product_id?: string | null; cart_quantity?: number | null }) =>
        row.cart_product_id && row.cart_quantity
    );
    for (const line of cartLines) {
      const result = await addToCart(customerId, line.cart_product_id, line.cart_quantity);
      if (result.success) mergedCartLines += 1;
    }

    let mergedWishlist = 0;
    const wishLines = (claimedRows || []).filter(
      (row: { wishlist_product_id?: string | null }) => row.wishlist_product_id
    );
    for (const line of wishLines) {
      const result = await addToCustomerWishlist(customerId, line.wishlist_product_id);
      if (result.success) mergedWishlist += 1;
    }

    await clearGuestCookie();

    return { success: true, data: { mergedCartLines, mergedWishlist } };
  } catch (error) {
    console.error('[mergeGuestStateIntoCustomer]', error);
    return {
      success: false,
      error: { message: 'Failed to merge guest cart', code: 'MERGE_ERROR' },
    };
  }
}
