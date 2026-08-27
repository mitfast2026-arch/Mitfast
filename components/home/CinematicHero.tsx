'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type HeroStats = {
  productCount: number;
  categoryCount: number;
};

export default function CinematicHero({
  stats,
}: {
  stats?: HeroStats;
}) {
  const productLabel =
    typeof stats?.productCount === 'number' && stats.productCount > 0
      ? String(stats.productCount)
      : '—';
  const categoryLabel =
    typeof stats?.categoryCount === 'number' && stats.categoryCount > 0
      ? String(stats.categoryCount)
      : '—';

  return (
    <section className="relative z-10 w-full min-h-screen min-h-[760px] max-h-[1100px] overflow-hidden flex flex-col justify-between">
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url('/images/homepage_banner_1.png')`,
          backgroundPosition: 'center center',
        }}
      />

      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pt-28 sm:pt-36 pb-6 flex-1 flex flex-col justify-center items-start text-left">
        <div className="max-w-xl space-y-6">
          <div className="text-[11px] sm:text-xs font-medium tracking-[0.25em] text-[#2A3036] uppercase flex items-center gap-2">
            <span className="w-2 h-[2px] bg-[#111315]" />
            <span>B2B SOURCING. FACTORY-DIRECT PRICING.</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-tight text-[#111315] leading-[1.05]">
            B2B <span className="bg-gradient-to-r from-[#111315] via-[#374151] to-[#1F2429] bg-clip-text text-transparent">Procurement.</span><br />
            Made Simple.
          </h1>

          <p className="text-sm sm:text-base text-[#1F2429] leading-relaxed max-w-md font-normal">
            Buy precision components, request quotes, and place orders from verified suppliers — all in one B2B marketplace.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              href="/#services"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#111315] hover:bg-[#1F2429] text-white text-xs sm:text-sm font-semibold transition-all shadow-md group"
            >
              <span>Explore Services</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>

            <Link
              href="/enquiry"
              className="liquid-glass-btn inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-[#111315] group"
            >
              <span>Get a Quote</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pb-8 sm:pb-12 pt-2">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              {productLabel}
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Live catalog products
            </div>
          </div>

          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              {categoryLabel}
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Product categories
            </div>
          </div>

          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              Factory
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Direct sourcing
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              Inspected
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Inspection-backed lots
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
