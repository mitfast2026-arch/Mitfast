'use client';

import React from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';

export default function AsymmetricShowcase() {
  return (
    <section
      id="asymmetric-showcase"
      className="relative w-full min-h-[90vh] sm:min-h-[85vh] bg-transparent pt-20 sm:pt-28 lg:pt-36 pb-20 sm:pb-28 lg:pb-36 overflow-hidden z-10"
    >
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        <div className="absolute w-[800px] h-[400px] bg-gradient-to-tr from-[#D7D9DC]/35 via-[#ECEEF0]/20 to-transparent rounded-full blur-3xl -top-10 opacity-60" />
        <div className="absolute w-[700px] h-[350px] bg-gradient-to-br from-[#1F2429]/5 via-[#111315]/5 to-transparent rounded-full blur-3xl bottom-0 opacity-70" />

        <svg
          className="w-full h-full min-w-[1440px] opacity-80"
          viewBox="0 0 1440 820"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#111315" stopOpacity="0.03" />
              <stop offset="50%" stopColor="#D7D9DC" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#ECEEF0" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id="waveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1F2429" stopOpacity="0.04" />
              <stop offset="50%" stopColor="#D7D9DC" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ECEEF0" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="strokeGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#111315" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#1F2429" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#111315" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id="strokeGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D7D9DC" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#1F2429" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#D7D9DC" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          <path
            d="M -100 380 C 240 260, 480 500, 820 320 C 1120 160, 1340 370, 1580 270 L 1580 820 L -100 820 Z"
            fill="url(#waveGrad1)"
          />

          <path
            d="M -100 290 C 280 400, 620 180, 960 350 C 1240 480, 1420 220, 1580 300 L 1580 820 L -100 820 Z"
            fill="url(#waveGrad2)"
          />

          <path
            d="M -80 350 C 220 220, 520 450, 840 290 C 1140 140, 1360 340, 1540 240"
            stroke="url(#strokeGrad1)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M -80 375 C 240 245, 540 475, 860 315 C 1160 165, 1380 365, 1540 265"
            stroke="url(#strokeGrad2)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M -80 255 C 300 370, 640 145, 980 320 C 1260 450, 1400 200, 1540 270"
            stroke="url(#strokeGrad1)"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M -80 280 C 320 395, 660 170, 1000 345 C 1280 475, 1420 225, 1540 295"
            stroke="url(#strokeGrad2)"
            strokeWidth="1"
            strokeDasharray="6 8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      <div className="w-full max-w-[1560px] mx-auto px-6 sm:px-10 lg:px-16 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-5 sm:space-y-6 lg:space-y-7">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-[#111315] uppercase bg-[#FFFFFF] px-4 py-1.5 rounded-full border border-[#E2E4E8] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#111315]" />
            <span>GLOBAL B2B SOURCING &amp; PROCUREMENT</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[54px] font-bold tracking-tight text-[#111315] leading-[1.1]">
            Source Products
            <br />
            <span className="inline-flex items-center justify-center gap-3 pt-1">
              <span className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#ECEEF0] border border-[#D7D9DC] inline-flex items-center justify-center text-[#111315] shadow-xs">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 animate-[spin_24s_linear_infinite]" />
              </span>
              <span className="text-[#111315]">Nationwide</span>
            </span>
          </h2>

          <p className="text-sm sm:text-base text-[#4B5563] max-w-xl mx-auto leading-relaxed pt-1">
            Buy precision CNC parts, aerospace fasteners, and hydraulic products
            from verified suppliers with transparent pricing and MOQ.
          </p>
        </div>

        <div className="mt-14 sm:mt-16 lg:mt-24 relative flex justify-center items-center py-4 sm:py-6">
          <div className="relative z-20 w-full max-w-[620px] sm:max-w-[740px] lg:max-w-[840px] drop-shadow-[0_30px_50px_rgba(0,0,0,0.22)] transition-transform duration-500 hover:scale-[1.01]">
            <Image
              src="/images/container.png"
              alt="B2B product sourcing and procurement"
              width={780}
              height={460}
              className="w-full h-auto object-contain"
              priority
            />
          </div>

          <div className="absolute -bottom-1 w-2/3 max-w-[620px] h-6 bg-black/15 rounded-full blur-xl z-10" />
        </div>
      </div>
    </section>
  );
}
