'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ShipBand() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      if (imageRef.current && containerRef.current) {
        gsap.to(imageRef.current, {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      if (contentRef.current && containerRef.current) {
        gsap.from(contentRef.current, {
          y: 30,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 75%',
            once: true,
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-[70vh] md:min-h-[80vh] flex items-center justify-center overflow-hidden bg-slate-950 py-24 md:py-32"
      aria-label="B2B product sourcing and supplier network"
    >
      {/* Background Aerial Cargo Ship Photo with Parallax */}
      <div ref={imageRef} className="absolute inset-0 scale-110 will-change-transform">
        <Image
          src="/images/hero-banner-2.png"
          alt="Aerial view of an industrial cargo container vessel navigating open ocean waters"
          fill
          sizes="100vw"
          className="object-cover object-center brightness-[0.82]"
        />
      </div>

      {/* Cinematic Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/80 pointer-events-none" />

      {/* Central Editorial Content */}
      <div
        ref={contentRef}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 text-center text-white space-y-10"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 border border-white/20 backdrop-blur-md text-emerald-400 text-xs font-semibold tracking-widest uppercase">
          <span>CHAPTER 02</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>B2B PRODUCT SOURCING</span>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-lg">
            Built for B2B buyers.
          </h2>
          <p className="text-base sm:text-xl text-slate-200 leading-relaxed max-w-2xl mx-auto font-light drop-shadow">
            Connect with verified suppliers for precision parts, RFQs, and bulk orders.
          </p>
        </div>

        {/* Industrial Command Telemetry Matrix */}
        <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
          <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 text-left space-y-1.5 shadow-xl">
            <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
              CATALOG CAPACITY
            </div>
            <div className="font-mono font-medium text-2xl sm:text-3xl text-white">
              12,000+
            </div>
            <div className="text-xs text-slate-300">
              Fastener & Hardware SKUs
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 text-left space-y-1.5 shadow-xl">
            <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
              CNC TOLERANCE
            </div>
            <div className="font-mono font-medium text-2xl sm:text-3xl text-white">
              ±0.005mm
            </div>
            <div className="text-xs text-slate-300">
              Fine Machining Class
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 text-left space-y-1.5 shadow-xl">
            <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
              QUALITY GATE
            </div>
            <div className="font-mono font-medium text-2xl sm:text-3xl text-white">
              100%
            </div>
            <div className="text-xs text-slate-300">
              CMM & Chemical Verified
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 text-left space-y-1.5 shadow-xl">
            <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
              RFQ SLA
            </div>
            <div className="font-mono font-medium text-2xl sm:text-3xl text-white">
              48h
            </div>
            <div className="text-xs text-slate-300">
              Guaranteed Contract Quote
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
