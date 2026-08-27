/**
 * Product structured data for Google merchant/product visibility.
 * Availability is derived from publication state (inventory is informational only).
 */

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    'https://mitfast-b2b.vercel.app';
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

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.name,
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
      availability: 'https://schema.org/InStock',
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
      target: `${siteUrl()}/products?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
