import { createAdminClient } from '@/lib/supabase/admin';
import { clearGuestCookie, peekGuestSessionId } from '@/lib/server/guest/session';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { getCustomerCart, addToCart } from '@/lib/server/cart/cart-service';
import { addToCustomerWishlist } from '@/lib/server/guest/wishlist-service';

/**
 * Merges guest cart + wishlist into the authenticated customer account, then clears guest state.
 * Idempotent if guest cookie is already gone.
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

    const { data: guestCart } = await admin
      .from('guest_cart_items')
      .select('product_id, quantity')
      .eq('guest_session_id', guestSessionId);

    const { data: guestWish } = await admin
      .from('guest_wishlist_items')
      .select('product_id')
      .eq('guest_session_id', guestSessionId);

    // Ensure customer cart exists
    await getCustomerCart(customerId);

    let mergedCartLines = 0;
    for (const line of guestCart || []) {
      const result = await addToCart(customerId, line.product_id, line.quantity);
      if (result.success) mergedCartLines += 1;
    }

    let mergedWishlist = 0;
    for (const line of guestWish || []) {
      const result = await addToCustomerWishlist(customerId, line.product_id);
      if (result.success) mergedWishlist += 1;
    }

    await admin.from('guest_cart_items').delete().eq('guest_session_id', guestSessionId);
    await admin.from('guest_wishlist_items').delete().eq('guest_session_id', guestSessionId);
    await admin
      .from('guest_sessions')
      .update({ expires_at: new Date(0).toISOString() })
      .eq('id', guestSessionId);

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
