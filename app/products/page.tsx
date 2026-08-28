import type { Metadata } from 'next';
import {
  getCachedPublicCategories,
  getCachedStorefrontProducts,
} from '@/lib/server/products/cached-storefront';
import { siteUrl } from '@/lib/seo/product-json-ld';
import ProductsCatalogClient from './ProductsCatalogClient';
import { parseMoqFilterBounds } from '@/lib/storefront/moq-filter';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Products Catalog',
  description:
    'Browse industrial fasteners, CNC turned parts, titanium hardware, and precision engineered B2B products from MITFAST.',
  alternates: {
    canonical: `${siteUrl()}/products`,
  },
  openGraph: {
    title: 'Products Catalog | MITFAST',
    description:
      'Browse industrial fasteners, CNC turned parts, titanium hardware, and precision engineered B2B products from MITFAST.',
    url: `${siteUrl()}/products`,
    type: 'website',
  },
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const page = Math.max(1, parseInt(firstParam(searchParams?.page) || '1', 10) || 1);
  const search = firstParam(searchParams?.search);
  const category =
    firstParam(searchParams?.cats)?.split(',').filter(Boolean)[0] ||
    firstParam(searchParams?.category);
  const minPrice = firstParam(searchParams?.minPrice);
  const maxPrice = firstParam(searchParams?.maxPrice);
  const sort = firstParam(searchParams?.sort) || 'relevance';
  const moq = firstParam(searchParams?.moq);

  let sortBy: string | undefined;
  if (sort === 'price_asc') sortBy = 'price_asc';
  else if (sort === 'price_desc') sortBy = 'price_desc';
  else if (sort === 'name_asc') sortBy = 'name_asc';

  const { moqMin, moqMax } = parseMoqFilterBounds(moq);

  const [productsRes, categoriesRes] = await Promise.all([
    getCachedStorefrontProducts({
      page,
      limit: 12,
      search: search || undefined,
      categoryId: category || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      moqMin,
      moqMax,
      sortBy,
    }),
    getCachedPublicCategories(),
  ]);

  const products = productsRes.success
    ? (productsRes.data.products || []).map((p: any) => ({
        ...p,
        supplier_country: p.supplier_country || p.supplier?.country || undefined,
      }))
    : [];
  const total = productsRes.success ? productsRes.data.total : 0;
  const categories = categoriesRes.success
    ? (categoriesRes.data.categories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        count: c.count ?? c.productCount ?? 0,
      }))
    : [];

  const seedKey = [page, search, minPrice, maxPrice, sort, moq, category].join('|');

  return (
    <>
      <nav aria-label="Product catalog" className="sr-only">
        <h1>MITFAST Products Catalog</h1>
        <ul>
          {products.map((p: { id: string; name: string }) => (
            <li key={p.id}>
              <a href={`/products/${p.id}`}>{p.name}</a>
            </li>
          ))}
        </ul>
      </nav>
      <ProductsCatalogClient
        initialProducts={products}
        initialCategories={categories}
        initialTotal={total}
        seedKey={seedKey}
      />
    </>
  );
}
