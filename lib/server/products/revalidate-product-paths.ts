import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Bust storefront caches after product mutations (tags + paths).
 */
export function revalidateProductCaches(productId?: string | null) {
  revalidateTag('products', { expire: 0 });
  revalidateTag('categories', { expire: 0 });
  revalidateTag('homepage', { expire: 0 });
  if (productId) {
    revalidateTag(`product:${productId}`, { expire: 0 });
  }
  revalidatePath('/products');
  revalidatePath('/categories');
  revalidatePath('/');
  if (productId) {
    revalidatePath(`/products/${productId}`);
  }
}

/** @deprecated Use deferRevalidateProduct in API routes */
export function revalidateProductPaths(productId?: string | null) {
  revalidateProductCaches(productId);
}

/**
 * Bust storefront caches after product mutations (tags + paths).
 * Runs synchronously so revalidation completes before the API response returns.
 */
export function deferRevalidateProduct(productId?: string | null) {
  try {
    revalidateProductCaches(productId);
    revalidatePath('/sitemap.xml');
  } catch (error) {
    console.error('[deferRevalidateProduct]', { productId, error });
  }
}
