'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, FileText, CheckCircle2, ShieldCheck, Microscope, Factory, Clock } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      if (bgRef.current && sectionRef.current) {
        gsap.to(bgRef.current, {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      if (cardRef.current && sectionRef.current) {
        gsap.from(cardRef.current, {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardRef.current,
            start: 'top 78%',
            once: true,
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative w-full min-h-[85vh] py-24 md:py-36 flex items-center overflow-hidden bg-slate-950"
      aria-label="About Mitfast Quality and Mission"
    >
      {/* Background Underwater Oceanic Image with Parallax */}
      <div ref={bgRef} className="absolute inset-0 scale-110 will-change-transform">
        <Image
          src="/images/hero-banner-3.png"
          alt="Sunlight caustics filtering through clear deep ocean waters"
          fill
          sizes="100vw"
          className="object-cover object-center brightness-[0.88]"
        />
      </div>

      {/* Atmospheric Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/85 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Mission Narrative in Crisp White */}
          <div className="lg:col-span-5 text-white space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/20 backdrop-blur-md text-emerald-400 text-xs font-semibold tracking-widest uppercase">
              <span>04 / QUALITY CHARTER</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>THE INTEGRITY GATE</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-md">
              Long-term precision.
              <br />
              <span className="text-emerald-300">Zero compromise.</span>
            </h2>

            <p className="text-slate-200 text-base sm:text-lg leading-relaxed font-light drop-shadow">
              Built for engineering and procurement teams that need reliable product quality. Every supplier on our platform is verified, and every order ships with inspection reports where applicable.
            </p>

            {/* 3 Quality Pillars */}
            <div className="pt-2 space-y-3 text-xs text-slate-200">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/10">
                <Microscope className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Spectrometer raw material alloy verification</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/10">
                <Factory className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Direct tier-one factory capacity allocation</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/10">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Confirmed delivery schedules with order tracking</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium White Card */}
          <div
            ref={cardRef}
            className="lg:col-span-7 bg-white/98 backdrop-blur-2xl rounded-3xl p-8 sm:p-12 shadow-2xl border border-white space-y-8"
          >
            {/* Top Teal Accent Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-1.5 w-16 bg-[#0d9488] rounded-full" />
              <span className="text-[11px] text-[#0f766e] bg-emerald-50 px-2.5 py-1 rounded font-bold uppercase tracking-wider">
                ISO 9001:2015 REGISTERED
              </span>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold tracking-widest text-[#0d9488] uppercase">
                ABOUT MITFAST
              </span>
              <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#090e17] tracking-tight">
                Built around better sourcing.
              </h3>
            </div>

            <div className="space-y-4 text-[#3f4f68] text-base leading-relaxed">
              <p>
                MITFAST is a B2B marketplace for precision fasteners, CNC turned parts, and hydraulic products. We connect verified suppliers with buyers who need certified parts at bulk pricing.
              </p>
              <p>
                Every listing carries factory MOQs, material mill test certificates (EN 10204 3.1), and a transparent pathway from digital RFQ to packed shipping crate, backed by 100% optical and CMM coordinate inspection.
              </p>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" />
                <span>Material Traceability (EN 10204 3.1)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" />
                <span>Direct Factory Floor Capacity</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" />
                <span>Locked Contract Volume Pricing</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" />
                <span>Custom CAD & 2D Drawing Inquiries</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center gap-3.5 border-t border-slate-100">
              <Link href="/products" className="home-btn-primary">
                <span>Explore Full Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/enquiry" className="home-btn-outline">
                <FileText className="w-4 h-4 text-slate-600" />
                <span>Submit Custom RFQ</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
