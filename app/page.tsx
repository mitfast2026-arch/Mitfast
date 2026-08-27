import React from 'react';
import CinematicHero from '@/components/home/CinematicHero';
import AsymmetricShowcase from '@/components/home/AsymmetricShowcase';
import ServicesScroll from '@/components/home/ServicesScroll';
import EditorialProducts from '@/components/home/EditorialProducts';
import FloatingTestimonials from '@/components/home/FloatingTestimonials';
import {
  getCachedPublicCategories,
  getCachedStorefrontProducts,
} from '@/lib/server/products/cached-storefront';

export const revalidate = 60;

export const metadata = {
  title: 'MITFAST — Precision Engineering & B2B Procurement',
  description:
    'Factory-direct B2B digital procurement for precision CNC turned components, titanium fasteners, and hydraulic assemblies. ISO 9001 & AS9100D certified.',
};

export default async function HomePage() {
  const [featured, categoriesResult] = await Promise.all([
    getCachedStorefrontProducts({ limit: 12, page: 1, sortBy: 'newest' }),
    getCachedPublicCategories(),
  ]);
  const initialProducts = featured.success ? featured.data.products : [];
  const productCount = featured.success ? featured.data.total : 0;
  const categoryCount = categoriesResult.success
    ? (categoriesResult.data.categories?.length ?? 0)
    : 0;

  return (
    <div id="home-page-shell" className="home-shell-transition w-full flex flex-col text-[#111315]">
      <CinematicHero stats={{ productCount, categoryCount }} />
      <AsymmetricShowcase />
      <ServicesScroll />
      <EditorialProducts initialProducts={initialProducts} />
      <FloatingTestimonials />
    </div>
  );
}
