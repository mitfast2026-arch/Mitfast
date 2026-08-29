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
import { getCachedHomepageCms } from '@/lib/server/homepage/cached-homepage';

export const revalidate = 60;

export const metadata = {
  title: 'MITFAST — Precision Engineering & B2B Procurement',
  description:
    'Factory-direct B2B digital procurement for precision CNC turned components, titanium fasteners, and hydraulic assemblies. ISO 9001 & AS9100D certified.',
};

export default async function HomePage() {
  const [featured, categoriesResult, homepageCms] = await Promise.all([
    getCachedStorefrontProducts({ limit: 12, page: 1, sortBy: 'newest' }),
    getCachedPublicCategories(),
    getCachedHomepageCms(),
  ]);

  const productCount = featured.success ? featured.data.total : 0;
  const categoryCount = categoriesResult.success
    ? (categoriesResult.data.categories?.length ?? 0)
    : 0;

  const cms = homepageCms.success ? homepageCms.data : null;
  const heroSlides = cms?.heroSlides ?? [];
  const containersImageUrl = cms?.containersImageUrl || '/images/container.png';
  const carouselProducts = cms?.carouselProducts ?? [];

  return (
    <div id="home-page-shell" className="home-shell-transition flex w-full min-w-0 flex-col text-[#111315]">
      <CinematicHero
        stats={{ productCount, categoryCount }}
        slides={heroSlides}
      />
      <EditorialProducts initialProducts={carouselProducts} />
      <ServicesScroll />
      <AsymmetricShowcase imageSrc={containersImageUrl} />
      <FloatingTestimonials />
    </div>
  );
}
