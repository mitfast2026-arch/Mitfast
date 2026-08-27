import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export function normalizeStorefrontSupplier<T extends { supplier?: unknown }>(product: T) {
  const raw = product.supplier;
  const supplier = Array.isArray(raw) ? raw[0] : raw;
  const country =
    supplier && typeof supplier === 'object' && 'country' in supplier
      ? (supplier as { country?: string | null }).country ?? null
      : null;

  return {
    ...product,
    supplier: supplier ?? null,
    supplier_country: country,
  };
}

export async function incrementProductView(productId: string): Promise<void> {
  // Truly deferred — fires asynchronously after response is generated
  setTimeout(() => {
    const adminClient = createAdminClient();
    // Atomic fire-and-forget view count increment via database RPC
    void Promise.resolve(
      (adminClient as any).rpc('increment_product_view', { p_id: productId })
    ).catch(() => {
      /* silently ignore — vanity counter */
    });
  }, 0);
}

/**
 * Storefront product detail — published, active, approved only.
 */
export async function getStorefrontProductDetail(productId: string): Promise<ServerResult<any>> {
  try {
    const adminClient = createAdminClient();

    const { data: product, error } = await adminClient
      .from('products')
      .select(`
        id,
        category_id,
        name,
        description,
        sku,
        stock_quantity,
        moq,
        selling_price,
        discount,
        gst_rate,
        gst_included,
        min_order_value,
        ribbon_label,
        created_at,
        category:categories(id, name),
        images:product_images(id, image_url, sort_order, is_primary),
        specifications:product_specifications(id, spec_name, spec_value, sort_order),
        supplier:suppliers(country, address)
      `)
      .eq('id', productId)
      .eq('publication_status', 'published')
      .eq('archive_status', 'active')
      .eq('approval_status', 'approved')
      .single();

    if (error || !product) {
      return {
        success: false,
        error: { message: 'Product not found or unavailable', code: 'NOT_FOUND' },
      };
    }

    incrementProductView(productId);

    return {
      success: true,
      data: { product: normalizeStorefrontSupplier(product) },
    };
  } catch (error) {
    console.error('[getStorefrontProductDetail] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to load product detail', code: 'INTERNAL_ERROR' },
    };
  }
}
