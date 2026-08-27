'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function CinematicHero() {
  return (
    <section className="relative z-10 w-full min-h-screen min-h-[760px] max-h-[1100px] overflow-hidden flex flex-col justify-between">
      {/* 1. Full-Bleed Atmospheric Background Image (Ship + Port Cranes) - Centered & Uncut */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: `url('/images/homepage_banner_1.png')`,
          backgroundPosition: 'center center',
        }}
      />

      {/* 2. Hero Main Content Area - Positioned to the far left of the screen */}
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pt-28 sm:pt-36 pb-6 flex-1 flex flex-col justify-center items-start text-left">
        <div className="max-w-xl space-y-6">
          
          {/* Eyebrow Tagline — Inter */}
          <div className="text-[11px] sm:text-xs font-medium tracking-[0.25em] text-[#2A3036] uppercase flex items-center gap-2">
            <span className="w-2 h-[2px] bg-[#111315]" />
            <span>B2B SOURCING. FACTORY-DIRECT PRICING.</span>
          </div>

          {/* Headline — Instrument Sans bold */}
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-tight text-[#111315] leading-[1.05]">
            B2B <span className="bg-gradient-to-r from-[#111315] via-[#374151] to-[#1F2429] bg-clip-text text-transparent">Procurement.</span><br />
            Made Simple.
          </h1>

          {/* Subtitle — Inter regular */}
          <p className="text-sm sm:text-base text-[#1F2429] leading-relaxed max-w-md font-normal">
            Buy precision components, request quotes, and place orders from verified suppliers — all in one B2B marketplace.
          </p>

          {/* CTA Buttons Row */}
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

      {/* 3. Bottom Stats */}
      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pb-8 sm:pb-12 pt-2">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          
          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              120+
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Countries
            </div>
          </div>

          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              500K+
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Orders Delivered
            </div>
          </div>

          <div className="space-y-0.5 pr-6 sm:pr-10 sm:border-r sm:border-[#111315]/25">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              24/7
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              Support
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-medium tracking-tight text-[#111315]">
              99.6%
            </div>
            <div className="text-xs sm:text-sm text-[#374151] font-normal">
              On-time delivery
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
