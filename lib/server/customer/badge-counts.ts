import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export type CustomerBadgeCounts = {
  orders: number;
  wishlist: number;
  cart: number;
  quotes: number;
};

/**
 * Lightweight head-counts for customer sidebar badges.
 * Avoids loading full order/RFQ/enquiry/wishlist/cart payloads.
 *
 * Enquiry count matches `/api/customer/enquiries`: customer_id OR guest_email.
 */
export async function getCustomerBadgeCounts(
  customerId: string,
  customerEmail?: string | null
): Promise<ServerResult<CustomerBadgeCounts>> {
  try {
    const admin = createAdminClient();

    let enquiriesQuery = admin
      .from('enquiries')
      .select('id', { count: 'exact', head: true });

    if (customerId && customerEmail) {
      enquiriesQuery = enquiriesQuery.or(
        `customer_id.eq.${customerId},guest_email.eq.${customerEmail}`
      );
    } else {
      enquiriesQuery = enquiriesQuery.eq('customer_id', customerId);
    }

    const [orders, wishlist, carts, rfqs, enquiries] = await Promise.all([
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId),
      admin
        .from('wishlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId),
      admin.from('carts').select('id').eq('customer_id', customerId).maybeSingle(),
      admin
        .from('rfqs')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId),
      enquiriesQuery,
    ]);

    let cartCount = 0;
    if (carts.data?.id) {
      const cartItems = await admin
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('cart_id', carts.data.id);
      cartCount = cartItems.count || 0;
    }

    return {
      success: true,
      data: {
        orders: orders.count || 0,
        wishlist: wishlist.count || 0,
        cart: cartCount,
        quotes: (rfqs.count || 0) + (enquiries.count || 0),
      },
    };
  } catch (error) {
    console.error('[getCustomerBadgeCounts]', error);
    return {
      success: false,
      error: { message: 'Failed to load badge counts', code: 'INTERNAL_ERROR' },
    };
  }
}
