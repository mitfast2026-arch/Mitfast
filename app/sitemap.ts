import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/seo/product-json-ld';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  let products: { id: string; updated_at: string | null }[] = [];
  let categories: { id: string; created_at: string | null }[] = [];

  try {
    const admin = createAdminClient();
    const [productsRes, categoriesRes] = await Promise.all([
      admin
        .from('products')
        .select('id, updated_at')
        .eq('publication_status', 'published')
        .eq('archive_status', 'active')
        .eq('approval_status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(5000),
      admin
        .from('categories')
        .select('id, created_at')
        .eq('status', 'active')
        .limit(500),
    ]);
    products = productsRes.data ?? [];
    categories = categoriesRes.data ?? [];
  } catch (err) {
    console.warn('[sitemap] Database unavailable during build; static URLs only.', err);
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/services`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/enquiry`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/products?category=${c.id}`,
    lastModified: c.created_at ? new Date(c.created_at) : undefined,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries, ...categoryEntries];
}
