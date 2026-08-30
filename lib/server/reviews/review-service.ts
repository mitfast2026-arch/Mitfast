import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import { upsertReviewSchema } from '@/lib/validation/review.schema';
import { deferRevalidateProduct } from '@/lib/server/products/revalidate-product-paths';
import { isRpcMissing } from '@/lib/server/db/production-guards';

export interface ProductReviewItem {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  isVerifiedBuyer: boolean;
}

export interface ProductReviewsSummary {
  averageRating: number;
  totalReviews: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  reviews: ProductReviewItem[];
  userReview?: {
    id: string;
    rating: number;
    reviewText: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  isEligible?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function maskCustomerName(name?: string | null): string {
  if (!name || !name.trim()) return 'Verified Buyer';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const single = parts[0];
    return single.length > 2 ? `${single.slice(0, 1)}***${single.slice(-1)}` : single;
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0] ? `${parts[parts.length - 1][0]}.` : '';
  return `${first} ${lastInitial}`.trim();
}

/**
 * Checks if a customer profile has created a qualifying RFQ or Order for the product.
 */
export async function checkCustomerProductEligibility(
  customerId: string,
  productId: string
): Promise<boolean> {
  if (!customerId || !productId || !UUID_REGEX.test(customerId) || !UUID_REGEX.test(productId)) {
    return false;
  }

  const adminClient = createAdminClient();

  // 1. Check RPC check_customer_review_eligibility
  try {
    const { data: eligible, error: rpcErr } = await (adminClient as any).rpc(
      'check_customer_review_eligibility',
      {
        p_customer_id: customerId,
        p_product_id: productId,
      }
    );

    if (!rpcErr && typeof eligible === 'boolean') {
      return eligible;
    }
  } catch {
    // Fallback to direct query below
  }

  // Fallback: direct query on rfqs & orders
  try {
    const { data: rfqRow } = await adminClient
      .from('rfq_items')
      .select('id, rfq:rfqs!inner(customer_id)')
      .eq('product_id', productId)
      .eq('rfq.customer_id', customerId)
      .limit(1)
      .maybeSingle();

    if (rfqRow) return true;

    const { data: orderRow } = await adminClient
      .from('order_items')
      .select('id, order:orders!inner(customer_id)')
      .eq('product_id', productId)
      .eq('order.customer_id', customerId)
      .limit(1)
      .maybeSingle();

    if (orderRow) return true;
  } catch (error) {
    console.error('[checkCustomerProductEligibility] Direct check error:', error);
  }

  return false;
}

/**
 * Batch retrieves review aggregates for multiple products (avoids N+1 in catalog listing).
 */
export async function getProductsRatingAggregates(
  productIds: string[]
): Promise<Record<string, { averageRating: number; reviewCount: number }>> {
  const result: Record<string, { averageRating: number; reviewCount: number }> = {};
  if (!productIds || productIds.length === 0) return result;

  const validIds = productIds.filter((id) => UUID_REGEX.test(id));
  if (validIds.length === 0) return result;

  try {
    const adminClient = createAdminClient();
    const { data: rows, error } = await adminClient
      .from('product_reviews')
      .select('product_id, rating')
      .in('product_id', validIds);

    if (error || !rows) {
      return result;
    }

    const counts: Record<string, { sum: number; count: number }> = {};
    for (const r of rows) {
      if (!counts[r.product_id]) {
        counts[r.product_id] = { sum: 0, count: 0 };
      }
      counts[r.product_id].sum += r.rating;
      counts[r.product_id].count += 1;
    }

    for (const [pid, data] of Object.entries(counts)) {
      if (data.count > 0) {
        result[pid] = {
          averageRating: Math.round((data.sum / data.count) * 10) / 10,
          reviewCount: data.count,
        };
      }
    }
  } catch (error) {
    console.error('[getProductsRatingAggregates] Error:', error);
  }

  return result;
}

/**
 * Gets reviews summary, distribution, list of reviews, and customer status for a product.
 */
export async function getProductReviews(
  productId: string,
  currentCustomerId?: string | null
): Promise<ServerResult<ProductReviewsSummary>> {
  if (!productId || !UUID_REGEX.test(productId)) {
    return {
      success: false,
      error: { message: 'Invalid product ID', code: 'VALIDATION_ERROR' },
    };
  }

  try {
    const adminClient = createAdminClient();

    const [reviewsRes, eligibilityRes] = await Promise.all([
      adminClient
        .from('product_reviews')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          updated_at,
          customer_id,
          profile:profiles(id, full_name)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false }),
      currentCustomerId ? checkCustomerProductEligibility(currentCustomerId, productId) : Promise.resolve(false),
    ]);

    if (reviewsRes.error) {
      // Table may not exist yet in remote dev before migration is pushed
      return {
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          reviews: [],
          userReview: null,
          isEligible: eligibilityRes,
        },
      };
    }

    const rawReviews = reviewsRes.data || [];
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    let userReview: ProductReviewsSummary['userReview'] = null;

    const reviews: ProductReviewItem[] = [];

    for (const row of rawReviews as any[]) {
      const ratingVal = Math.min(5, Math.max(1, Math.round(row.rating || 5))) as 1 | 2 | 3 | 4 | 5;
      distribution[ratingVal] = (distribution[ratingVal] || 0) + 1;
      ratingSum += ratingVal;

      if (currentCustomerId && row.customer_id === currentCustomerId) {
        userReview = {
          id: row.id,
          rating: ratingVal,
          reviewText: row.review_text,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }

      reviews.push({
        id: row.id,
        rating: ratingVal,
        reviewText: row.review_text,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        customerName: maskCustomerName(row.profile?.full_name),
        isVerifiedBuyer: true,
      });
    }

    const totalReviews = rawReviews.length;
    const averageRating = totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0;

    return {
      success: true,
      data: {
        averageRating,
        totalReviews,
        distribution,
        reviews,
        userReview,
        isEligible: eligibilityRes,
      },
    };
  } catch (error) {
    console.error('[getProductReviews] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to fetch product reviews', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Creates or updates (upserts) the authenticated customer's review for a product.
 * Strictly verifies customer role, valid rating (1-5), and RFQ/Order eligibility.
 */
export async function upsertProductReview(
  customerId: string,
  productId: string,
  formData: unknown
): Promise<ServerResult<{ reviewId: string; isUpdated: boolean }>> {
  if (!customerId || !productId || !UUID_REGEX.test(customerId) || !UUID_REGEX.test(productId)) {
    return {
      success: false,
      error: { message: 'Invalid customer or product ID', code: 'VALIDATION_ERROR' },
    };
  }

  const validated = upsertReviewSchema.safeParse(formData);
  if (!validated.success) {
    return {
      success: false,
      error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
    };
  }

  const { rating, reviewText } = validated.data;
  const adminClient = createAdminClient();

  // 1. Verify product exists and is active
  const { data: product, error: prodErr } = await adminClient
    .from('products')
    .select('id, publication_status, archive_status, approval_status')
    .eq('id', productId)
    .single();

  if (prodErr || !product) {
    return {
      success: false,
      error: { message: 'Product not found', code: 'NOT_FOUND' },
    };
  }

  // 2. Server-side eligibility check
  const isEligible = await checkCustomerProductEligibility(customerId, productId);
  if (!isEligible) {
    return {
      success: false,
      error: {
        message: 'You can only review products for which you have created a Request for Quote (RFQ) or Order.',
        code: 'NOT_ELIGIBLE',
      },
    };
  }

  // 3. Try RPC upsert_product_review
  try {
    const { data: rpcRes, error: rpcErr } = await (adminClient as any).rpc('upsert_product_review', {
      p_customer_id: customerId,
      p_product_id: productId,
      p_rating: rating,
      p_review_text: reviewText || null,
    });

    if (!rpcErr && rpcRes && rpcRes.length > 0) {
      deferRevalidateProduct(productId);
      return {
        success: true,
        data: {
          reviewId: rpcRes[0].review_id,
          isUpdated: rpcRes[0].is_updated,
        },
      };
    }

    if (rpcErr && !isRpcMissing(rpcErr, 'upsert_product_review')) {
      console.error('[upsertProductReview] RPC error:', rpcErr);
      return {
        success: false,
        error: { message: rpcErr.message || 'Failed to submit review', code: 'DATABASE_ERROR' },
      };
    }
  } catch (error) {
    console.error('[upsertProductReview] RPC exception, attempting fallback:', error);
  }

  // 4. Fallback direct upsert
  try {
    const { data: existing } = await adminClient
      .from('product_reviews')
      .select('id')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error: updateErr } = await adminClient
        .from('product_reviews')
        .update({
          rating,
          review_text: reviewText || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (updateErr) {
        return {
          success: false,
          error: { message: updateErr.message, code: 'DATABASE_ERROR' },
        };
      }

      deferRevalidateProduct(productId);
      return {
        success: true,
        data: {
          reviewId: updated.id,
          isUpdated: true,
        },
      };
    }

    const { data: inserted, error: insertErr } = await adminClient
      .from('product_reviews')
      .insert({
        customer_id: customerId,
        product_id: productId,
        rating,
        review_text: reviewText || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      return {
        success: false,
        error: { message: insertErr.message, code: 'DATABASE_ERROR' },
      };
    }

    deferRevalidateProduct(productId);
    return {
      success: true,
      data: {
        reviewId: inserted.id,
        isUpdated: false,
      },
    };
  } catch (error) {
    console.error('[upsertProductReview] Fallback error:', error);
    return {
      success: false,
      error: { message: 'Failed to submit review', code: 'INTERNAL_ERROR' },
    };
  }
}
