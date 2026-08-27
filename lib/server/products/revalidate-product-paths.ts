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
 * Return mutation response immediately; revalidate storefront caches on next tick.
 */
export function deferRevalidateProduct(productId?: string | null) {
  void Promise.resolve().then(() => {
    try {
      revalidateProductCaches(productId);
      revalidatePath('/sitemap.xml');
    } catch (error) {
      console.error('[deferRevalidateProduct]', { productId, error });
    }
  });
}
