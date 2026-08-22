'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import CurvedProductCarousel from './curved-products/CurvedProductCarousel';
import { mapApiProductToCurved, type CurvedProduct } from './curved-products/productData';

export default function EditorialProducts() {
  const [products, setProducts] = useState<CurvedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const res = await fetch('/api/products?limit=12');
        const json = await res.json();
        if (cancelled || !json.success) return;
        const list = (json.data?.products || []) as Parameters<typeof mapApiProductToCurved>[0][];
        setProducts(list.map(mapApiProductToCurved));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="products"
      className="relative z-10 w-full bg-[#F7F7F8] pt-24 sm:pt-32 pb-20 sm:pb-28 overflow-x-clip overflow-y-visible"
      aria-label="3D Cylindrical Precision Components Showcase"
    >
      <div className="w-full max-w-[1100px] mx-auto px-6 sm:px-10 text-center space-y-5 mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-[#111315] uppercase bg-white px-4 py-1.5 rounded-full border border-[#E2E4E8] shadow-2xs">
          <Compass className="w-3.5 h-3.5 text-[#111315] animate-spin" style={{ animationDuration: '30s' }} />
          <span>PARAMETRIC 3D COMPONENT GALLERY</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-[#111315] leading-[1.08]">
          Engineered for Microns.
          <br />
          <span className="font-display italic font-normal text-[#4B5563]">
            Presented in 3D Space.
          </span>
        </h2>

        <p className="text-sm sm:text-base text-[#6B7280] leading-relaxed max-w-xl mx-auto">
          Interactive cylindrical projection of published catalog products — drag to rotate through
          certified production components from our live inventory.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111315] hover:bg-[#1F2429] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm group"
          >
            <span>Explore Full Catalog</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-[#ECEEF0] text-[#111315] border border-[#E2E4E8] text-xs sm:text-sm font-semibold transition-all shadow-xs"
          >
            <span>Request Custom RFQ</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#6B7280]">Loading products…</div>
      ) : (
        <CurvedProductCarousel products={products} />
      )}
    </section>
  );
}
