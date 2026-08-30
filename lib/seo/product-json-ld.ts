import { stripHtmlTags } from '@/lib/html/strip-html';

/**
 * Product structured data for Google merchant/product visibility.
 * Availability is derived from publication state (inventory is informational only).
 */

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    'https://mitfast-b2b-puce.vercel.app';
  const withProtocol = raw.startsWith('http') ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, '');
}

export function buildProductJsonLd(product: {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  selling_price?: number | null;
  discount?: number | null;
  stock_quantity?: number | null;
  images?: Array<{ image_url: string; is_primary?: boolean }>;
  category?: { name?: string } | null;
}): Record<string, unknown> {
  const unitPrice = Math.max(
    0,
    Math.round((Number(product.selling_price || 0) - Number(product.discount || 0)) * 100) / 100
  );
  const image =
    product.images?.find((img) => img.is_primary)?.image_url ||
    product.images?.[0]?.image_url ||
    undefined;
  const url = `${siteUrl()}/products/${product.id}`;

  // stock_quantity is informational only — never reserved/decremented.
  const inStock =
    product.stock_quantity == null || Number(product.stock_quantity) > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: (product.description ? stripHtmlTags(product.description) : '') || product.name,
    sku: product.sku || product.id,
    url,
    image: image ? [image] : undefined,
    category: product.category?.name || undefined,
    brand: {
      '@type': 'Brand',
      name: 'MITFAST',
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: unitPrice,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MITFAST',
    url: siteUrl(),
    description:
      'B2B marketplace for precision CNC turned parts, titanium fasteners, hydraulic couplings, and custom engineered products.',
  };
}

export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MITFAST',
    url: siteUrl(),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl()}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildCatalogItemListJsonLd(products: Array<{ id: string; name: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MITFAST Industrial Products Catalog',
    itemListElement: products.map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: p.name,
      url: `${siteUrl()}/products/${p.id}`,
    })),
  };
}
