import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo/product-json-ld';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/supplier/', '/customer/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
