import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { isRpcMissing } from '@/lib/server/db/production-guards';
import { sanitizeRichTextHtml } from '@/lib/html/sanitize-rich-text.server';
import { getProductsRatingAggregates } from '@/lib/server/reviews/review-service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Record a single product detail view for published/active products.
 * Uses atomic Postgres RPC with rate-limited sampled window (30 mins = 1800s).
 */
export async function trackStorefrontProductView(
  productId: string,
  sampleKey = 'anon'
): Promise<ServerResult<{ tracked: boolean }>> {
  if (!productId || !UUID_REGEX.test(productId)) {
    return {
      success: false,
      error: { message: 'Invalid product ID', code: 'VALIDATION_ERROR' },
    };
  }

  try {
    const adminClient = createAdminClient();

    // Verify product exists and is publicly active
    const { data: product, error: fetchErr } = await adminClient
      .from('products')
      .select('id, supplier_id, publication_status, archive_status, approval_status, view_count')
      .eq('id', productId)
      .single();

    if (fetchErr || !product) {
      return {
        success: false,
        error: { message: 'Product not found', code: 'NOT_FOUND' },
      };
    }

    if (
      product.publication_status !== 'published' ||
      product.archive_status !== 'active' ||
      product.approval_status !== 'approved'
    ) {
      return {
        success: false,
        error: { message: 'Product is not available', code: 'NOT_FOUND' },
      };
    }

    // Attempt rate-limited sampled increment (30-minute deduplication window = 1800s)
    const { error: rpcError } = await (adminClient as any).rpc('increment_product_view_sampled', {
      p_id: productId,
      p_sample_key: sampleKey || 'anon',
      p_window_seconds: 1800,
    });

    if (rpcError) {
      if (isRpcMissing(rpcError, 'increment_product_view_sampled')) {
        // Fallback: standard increment RPC or direct update in non-prod/dev
        const { error: fallbackRpcErr } = await (adminClient as any).rpc('increment_product_view', {
          p_id: productId,
        });

        if (fallbackRpcErr) {
          await adminClient
            .from('products')
            .update({
              view_count: (product.view_count ?? 0) + 1,
            })
            .eq('id', productId);
        }
      } else {
        console.error('[trackStorefrontProductView] RPC error:', rpcError);
      }
    }

    return {
      success: true,
      data: { tracked: true },
    };
  } catch (error) {
    console.error('[trackStorefrontProductView] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to record product view', code: 'INTERNAL_ERROR' },
    };
  }
}

/** Legacy wrapper alias for compatibility */
export async function incrementProductView(
  productId: string,
  sampleKey = 'anon'
): Promise<void> {
  void trackStorefrontProductView(productId, sampleKey).catch(() => {});
}

/**
 * Storefront product detail — published, active, approved only.
 * Pure read-only query; never mutates view count.
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
        supplier:suppliers(country)
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

    const normalized = normalizeStorefrontSupplier(product);
    const descriptionHtml = product.description
      ? sanitizeRichTextHtml(product.description)
      : '';

    const ratingMap = await getProductsRatingAggregates([productId]);
    const ratingInfo = ratingMap[productId];

    return {
      success: true,
      data: {
        product: {
          ...normalized,
          rating: ratingInfo ? ratingInfo.averageRating : null,
          review_count: ratingInfo ? ratingInfo.reviewCount : 0,
          descriptionHtml,
        },
      },
    };
  } catch (error) {
    console.error('[getStorefrontProductDetail] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to load product detail', code: 'INTERNAL_ERROR' },
    };
  }
}
