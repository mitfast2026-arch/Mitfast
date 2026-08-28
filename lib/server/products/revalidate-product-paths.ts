import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Bust storefront caches after product mutations (tags + paths).
 */
export function revalidateProductCaches(productId?: string | null) {
  revalidateTag('products');
  revalidateTag('categories');
  revalidateTag('homepage');
  if (productId) {
    revalidateTag(`product:${productId}`);
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
