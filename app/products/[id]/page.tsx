import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCachedStorefrontProductDetail } from '@/lib/server/products/cached-storefront';
import { buildProductJsonLd, siteUrl } from '@/lib/seo/product-json-ld';
import { serializeJsonLd } from '@/lib/server/seo/json-ld';
import {
  sanitizeRichTextHtml,
  stripRichTextHtml,
} from '@/lib/html/sanitize-rich-text.server';
import ProductDetailClient from './ProductDetailClient';

export const revalidate = 60;

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const result = await getCachedStorefrontProductDetail(params.id);
  if (!result.success) {
    return {
      title: 'Product not found | MITFAST',
      robots: { index: false, follow: false },
    };
  }

  const product = result.data.product;
  const unitPrice = Math.max(0, Number(product.selling_price || 0) - Number(product.discount || 0));
  const description =
    (typeof product.description === 'string' && stripRichTextHtml(product.description)) ||
    `${product.name} — industrial B2B product from MITFAST. MOQ ${product.moq || 1}.`;
  const image =
    product.images?.find((img: { is_primary?: boolean }) => img.is_primary)?.image_url ||
    product.images?.[0]?.image_url ||
    undefined;
  const canonical = `${siteUrl()}/products/${product.id}`;

  return {
    title: product.name,
    description: description.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      title: product.name,
      description: description.slice(0, 160),
      url: canonical,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: description.slice(0, 160),
      images: image ? [image] : undefined,
    },
    other: {
      'product:price:amount': String(unitPrice),
      'product:price:currency': 'INR',
    },
  };
}

export default async function ProductDetailPage(props: PageProps) {
  const params = await props.params;
  const result = await getCachedStorefrontProductDetail(params.id);
  if (!result.success) {
    notFound();
  }

  const product = result.data.product;
  const jsonLd = buildProductJsonLd(product);
  const descriptionHtml =
    product.descriptionHtml ||
    (product.description ? sanitizeRichTextHtml(product.description) : '');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <noscript>
        <article>
          <h1>{product.name}</h1>
          {product.description ? <p>{stripRichTextHtml(product.description)}</p> : null}
          <p>
            Price: ₹
            {Math.max(
              0,
              Number(product.selling_price || 0) - Number(product.discount || 0)
            ).toLocaleString('en-IN')}
          </p>
          <p>MOQ: {product.moq || 1}</p>
          {product.sku ? <p>SKU: {product.sku}</p> : null}
        </article>
      </noscript>
      <ProductDetailClient
        initialProduct={{
          ...product,
          descriptionHtml,
        }}
      />
    </>
  );
}
