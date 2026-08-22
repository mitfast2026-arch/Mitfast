import React from 'react';
import CinematicHero from '@/components/home/CinematicHero';
import AsymmetricShowcase from '@/components/home/AsymmetricShowcase';
import ServicesScroll from '@/components/home/ServicesScroll';
import EditorialProducts from '@/components/home/EditorialProducts';
import FloatingTestimonials from '@/components/home/FloatingTestimonials';

export const revalidate = 60;

export const metadata = {
  title: 'MITFAST — Precision Engineering & B2B Procurement',
  description:
    'Factory-direct B2B digital procurement for precision CNC turned components, titanium fasteners, and hydraulic assemblies. ISO 9001 & AS9100D certified.',
};

export default function HomePage() {
  return (
    <div id="home-page-shell" className="home-shell-transition w-full flex flex-col text-[#111315]">
      <CinematicHero />
      <AsymmetricShowcase />
      <ServicesScroll />
      <EditorialProducts />
      <FloatingTestimonials />
    </div>
  );
}
