import { unstable_cache } from 'next/cache';
import { getStorefrontProductDetail } from '@/lib/server/products/storefront-detail';
import { getStorefrontProducts } from '@/lib/server/products/product-service';
import { getCategories } from '@/lib/server/categories/category-service';

/**
 * Tagged Next.js data cache for storefront reads.
 * Invalidated by revalidateTag('products'|'categories'|`product:{id}`) in
 * lib/server/products/revalidate-product-paths.ts
 */

export function getCachedStorefrontProductDetail(productId: string) {
  return unstable_cache(
    async () => getStorefrontProductDetail(productId),
    ['storefront-product', productId],
    {
      revalidate: 60,
      tags: ['products', `product:${productId}`],
    }
  )();
}

export function getCachedStorefrontProducts(params: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
  moqMin?: number;
  moqMax?: number;
}) {
  const key = JSON.stringify({
    categoryId: params.categoryId || '',
    search: params.search || '',
    page: params.page || 1,
    limit: params.limit || 20,
    sortBy: params.sortBy || '',
    minPrice: params.minPrice ?? '',
    maxPrice: params.maxPrice ?? '',
    moqMin: params.moqMin ?? '',
    moqMax: params.moqMax ?? '',
  });

  return unstable_cache(
    async () => getStorefrontProducts(params),
    ['storefront-products', key],
    {
      revalidate: 60,
      tags: ['products'],
    }
  )();
}

export function getCachedPublicCategories() {
  return unstable_cache(
    async () => getCategories({ mode: 'public', status: 'active' }),
    ['storefront-categories'],
    {
      revalidate: 60,
      tags: ['categories'],
    }
  )();
}
