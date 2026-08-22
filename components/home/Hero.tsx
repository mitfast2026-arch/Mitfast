'use client';

import React from 'react';
import Image from 'next/image';

export default function Hero() {
  return (
    <section
      id="home"
      className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-950"
      aria-label="MITFAST Hero Banner"
    >
      {/* Full-Screen High-Resolution Banner Image (No Text) */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src="/images/homepage-banner-1.png"
          alt="MITFAST Industrial Precision Engineering & Fasteners"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center w-full h-full select-none"
        />
      </div>

      {/* Top Masked Shadow / Dark Gradient for High-Contrast Nav Legibility */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/55 via-black/20 to-transparent pointer-events-none z-10" />

      {/* Bottom Gradient Blend into Services Section */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#f8f9fb] via-[#f8f9fb]/50 to-transparent pointer-events-none z-10" />
    </section>
  );
}
