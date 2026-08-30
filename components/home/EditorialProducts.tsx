'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CurvedProductCarousel from './curved-products/CurvedProductCarousel';
import { mapApiProductToCurved, type CurvedProduct } from './curved-products/productData';

type ApiProduct = Parameters<typeof mapApiProductToCurved>[0];

export default function EditorialProducts({
  initialProducts,
}: {
  initialProducts?: ApiProduct[];
}) {
  const products: CurvedProduct[] = (initialProducts || []).map(mapApiProductToCurved);

  return (
    <section
      id="products"
      className="relative z-10 w-full bg-[#F7F7F8] pt-6 sm:pt-10 md:pt-14 lg:pt-32 pb-6 sm:pt-10 md:pb-14 lg:pb-28 overflow-x-clip overflow-y-visible"
      aria-label="Featured products showcase"
    >
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-10 text-center space-y-2.5 sm:space-y-4 lg:space-y-5 mb-2 sm:mb-4 lg:mb-12">
        <h2 className="text-[28px] sm:text-[34px] md:text-4xl lg:text-[56px] font-bold tracking-tight text-[#111315] leading-[1.12] sm:leading-[1.08]">
          Engineered for Microns.
          <span className="block font-display italic font-normal text-[#4B5563] text-lg sm:text-[22px] md:text-2xl lg:text-[48px] mt-0.5">
            Presented in 3D Space.
          </span>
        </h2>

        <p className="text-[13.5px] sm:text-[15px] lg:text-base text-[#6B7280] leading-relaxed max-w-md sm:max-w-xl mx-auto">
          Interactive cylindrical projection of published catalog products — drag to rotate through
          certified products from our live inventory.
        </p>

        <div className="pt-1 sm:pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[#111315] hover:bg-[#1F2429] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm group whitespace-nowrap"
          >
            <span>Explore Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      <CurvedProductCarousel products={products} />
    </section>
  );
}
