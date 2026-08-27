import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export type WishlistItem = {
  id: string;
  productId: string;
  addedAt: string;
  product: {
    id: string;
    name: string;
    primaryImage: string | null;
    isAvailable: boolean;
  };
};

async function mapWishlistRows(
  rows: {
    id: string;
    product_id: string;
    added_at: string;
    product: {
      id: string;
      name: string;
      publication_status: string;
      archive_status: string;
      approval_status: string;
      images?: { image_url: string; is_primary?: boolean }[] | null;
    } | null;
  }[]
): Promise<WishlistItem[]> {
  return rows
    .filter((r) => r.product)
    .map((r) => {
      const p = r.product!;
      const primaryImg =
        p.images?.find((img) => img.is_primary)?.image_url || p.images?.[0]?.image_url || null;
      return {
        id: r.id,
        productId: r.product_id,
        addedAt: r.added_at,
        product: {
          id: p.id,
          name: p.name,
          primaryImage: primaryImg,
          isAvailable:
            p.publication_status === 'published' &&
            p.archive_status === 'active' &&
            p.approval_status === 'approved',
        },
      };
    });
}

const PRODUCT_SELECT = `
  id, name, publication_status, archive_status, approval_status,
  images:product_images(image_url, is_primary)
`;

export async function getCustomerWishlist(
  customerId: string,
  options?: { limit?: number }
): Promise<ServerResult<{ items: WishlistItem[]; itemCount: number }>> {
  const admin = createAdminClient();
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const { data, error } = await admin
    .from('wishlist_items')
    .select(`id, product_id, added_at, product:products(${PRODUCT_SELECT})`)
    .eq('customer_id', customerId)
    // Primary image is picked in JS — do not order/limit on product_images
    // via foreignTable here (PostgREST rejects embeds nested under wishlist_items).
    .order('added_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
  }

  const items = await mapWishlistRows((data || []) as any);
  return { success: true, data: { items, itemCount: items.length } };
}

export async function getGuestWishlist(
  guestSessionId: string
): Promise<ServerResult<{ items: WishlistItem[]; itemCount: number }>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('guest_wishlist_items')
    .select(`id, product_id, added_at, product:products(${PRODUCT_SELECT})`)
    .eq('guest_session_id', guestSessionId)
    // Primary image is picked in JS — do not order/limit on product_images
    // via foreignTable here (PostgREST rejects embeds nested under guest_wishlist_items).
    .order('added_at', { ascending: false });

  if (error) {
    return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
  }

  const items = await mapWishlistRows((data || []) as any);
  return { success: true, data: { items, itemCount: items.length } };
}

export async function addToCustomerWishlist(
  customerId: string,
  productId: string
): Promise<ServerResult<{ added: boolean }>> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('products')
    .select('id, publication_status, archive_status, approval_status')
    .eq('id', productId)
    .maybeSingle();

  if (
    !product ||
    product.publication_status !== 'published' ||
    product.archive_status !== 'active' ||
    product.approval_status !== 'approved'
  ) {
    return { success: false, error: { message: 'Product unavailable', code: 'UNAVAILABLE' } };
  }

  const { error } = await admin.from('wishlist_items').upsert(
    { customer_id: customerId, product_id: productId },
    { onConflict: 'customer_id,product_id', ignoreDuplicates: true }
  );

  if (error) {
    return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
  }
  return { success: true, data: { added: true } };
}

export async function addToGuestWishlist(
  guestSessionId: string,
  productId: string
): Promise<ServerResult<{ added: boolean }>> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('products')
    .select('id, publication_status, archive_status, approval_status')
    .eq('id', productId)
    .maybeSingle();

  if (
    !product ||
    product.publication_status !== 'published' ||
    product.archive_status !== 'active' ||
    product.approval_status !== 'approved'
  ) {
    return { success: false, error: { message: 'Product unavailable', code: 'UNAVAILABLE' } };
  }

  const { error } = await admin.from('guest_wishlist_items').upsert(
    { guest_session_id: guestSessionId, product_id: productId },
    { onConflict: 'guest_session_id,product_id', ignoreDuplicates: true }
  );

  if (error) {
    return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
  }
  return { success: true, data: { added: true } };
}

export async function removeCustomerWishlistItem(
  customerId: string,
  productId: string
): Promise<ServerResult<{ removed: boolean }>> {
  const admin = createAdminClient();
  await admin.from('wishlist_items').delete().eq('customer_id', customerId).eq('product_id', productId);
  return { success: true, data: { removed: true } };
}

export async function removeGuestWishlistItem(
  guestSessionId: string,
  productId: string
): Promise<ServerResult<{ removed: boolean }>> {
  const admin = createAdminClient();
  await admin
    .from('guest_wishlist_items')
    .delete()
    .eq('guest_session_id', guestSessionId)
    .eq('product_id', productId);
  return { success: true, data: { removed: true } };
}
