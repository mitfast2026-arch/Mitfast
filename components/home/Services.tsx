'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Layers, ShieldCheck, FileCheck, Truck, Check, Search, TrendingDown, Gauge } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SERVICES } from '@/lib/home/content';

gsap.registerPlugin(ScrollTrigger);

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('.service-row-card');
      rows.forEach((row) => {
        gsap.from(row, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 82%',
            once: true,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative bg-[#f8f9fb] py-24 md:py-36 border-b border-slate-200/80"
      aria-label="Our Sourcing Services"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-20">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="home-badge-teal">01 / CAPABILITIES</span>
            <span className="home-badge-mono">END-TO-END SOURCING PIPELINE</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#090e17] leading-[1.12]">
            Comprehensive procurement.
            <br />
            <span className="text-[#3f4f68] font-semibold">From CAD drawing to container dispatch.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#3f4f68] leading-relaxed max-w-2xl">
            Whether developing bespoke CNC prototypes, procuring unlisted fasteners, or scaling high-volume contract runs, Mitfast delivers verified manufacturing capacity.
          </p>
        </div>

        {/* 4 Alternating Master Modules */}
        <div className="space-y-16 lg:space-y-24">
          {/* =========================================================================
              SERVICE 01: Sourcing Development
             ========================================================================= */}
          <div className="service-row-card grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/80 shadow-card">
            {/* Left: Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-[#0d9488] uppercase">
                  01 / SOURCING DEVELOPMENT
                </span>
                <span className="text-4xl font-mono font-medium text-slate-100">01</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#090e17] tracking-tight">
                {SERVICES[0].title}
              </h3>

              <p className="text-base text-[#3f4f68] leading-relaxed">
                {SERVICES[0].description}
              </p>

              {/* Capability checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-medium text-[#090e17]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>DFM & CAD Topology Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Precision CNC 5-Axis Turning</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>First Article Inspection (FAI)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>ISO 9001 Plant Audit Record</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/enquiry?type=sourcing"
                  className="home-btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2"
                >
                  <span>Start Sourcing RFQ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: Technical Spec Sheet Card */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Layers className="w-4 h-4" />
                  <span>DFM TECHNICAL PARAMETERS</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                  PASS
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">TOLERANCE CLASS</span>
                  <span className="font-bold text-white">±0.005 mm (DIN ISO 2768-m)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">SURFACE ROUGHNESS</span>
                  <span className="font-bold text-emerald-400">Ra 0.4 µm (Honed)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">MATERIAL GRADE</span>
                  <span className="font-bold text-white">Ti-6Al-4V / SS316L</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">CERTIFICATE</span>
                  <span className="font-bold text-white">EN 10204 3.1 Attached</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 flex items-center gap-2.5 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>100% CMM Coordinate Inspection Included</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SERVICE 02: Procurement Service (Reversed)
             ========================================================================= */}
          <div className="service-row-card grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/80 shadow-card">
            {/* Left: Visual Component Card */}
            <div className="lg:col-span-5 relative h-72 rounded-2xl overflow-hidden shadow-md border border-slate-200 order-2 lg:order-1 bg-slate-900">
              <Image
                src="/images/hero-banner-2.png"
                alt="Off-catalog fastener and industrial component discovery network"
                fill
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover object-center opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold uppercase">
                  <Search className="w-3.5 h-3.5" />
                  <span>SUPPLIER CAPACITY RADAR</span>
                </div>
                <div className="text-sm font-display font-semibold">
                  Access 400+ Accredited Tooling & Fastener Plants
                </div>
                <div className="text-xs text-slate-300">
                  Custom alloy wire drawing, hot forging, and specialized plating.
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-[#0d9488] uppercase">
                  02 / OFF-CATALOG PROCUREMENT
                </span>
                <span className="text-4xl font-mono font-medium text-slate-100">02</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#090e17] tracking-tight">
                {SERVICES[1].title}
              </h3>

              <p className="text-base text-[#3f4f68] leading-relaxed">
                {SERVICES[1].description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-medium text-[#090e17]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Obsolete & Rare Spec Discovery</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Direct Factory Contract Negotiation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Custom Tooling & Die Sourcing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Export Compliance Verification</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/enquiry?type=procurement"
                  className="home-btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2"
                >
                  <span>Request Custom Part</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SERVICE 03: Quote for Product
             ========================================================================= */}
          <div className="service-row-card grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/80 shadow-card">
            {/* Left: Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-[#0d9488] uppercase">
                  03 / CATALOG PRICING
                </span>
                <span className="text-4xl font-mono font-medium text-slate-100">03</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#090e17] tracking-tight">
                {SERVICES[2].title}
              </h3>

              <p className="text-base text-[#3f4f68] leading-relaxed">
                {SERVICES[2].description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-medium text-[#090e17]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Multi-Tier Volume Price Discounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>30-Day Locked Price Freezes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Blanket Purchase Order Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Automated Instant RFQ Generation</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/products"
                  className="home-btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2"
                >
                  <span>Browse Listed Fasteners</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: Volume Tier Matrix Card */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#090e17]">
                  <TrendingDown className="w-4 h-4 text-[#0d9488]" />
                  <span>LIVE VOLUME PRICING ENGINE</span>
                </div>
                <span className="text-[10px] text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded font-bold">
                  DIRECT MOQ
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200/80">
                  <div>
                    <div className="font-mono font-medium text-slate-900">MOQ 5,000 PCS</div>
                    <div className="text-[10px] text-slate-500">Standard Production Run</div>
                  </div>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                    Tier 1 Base Rate
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200/80">
                  <div>
                    <div className="font-mono font-medium text-slate-900">MOQ 25,000 PCS</div>
                    <div className="text-[10px] text-slate-500">Volume Contract Run</div>
                  </div>
                  <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    -18% Factory Direct
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div>
                    <div className="font-mono font-medium text-emerald-950">MOQ 100,000+ PCS</div>
                    <div className="text-[10px] text-emerald-800">Annual Scheduled Batch</div>
                  </div>
                  <span className="font-bold text-emerald-900 bg-emerald-400/30 px-2.5 py-1 rounded">
                    Max Direct Discount
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#718096] flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Raw material indexed price freeze for 30 days.</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SERVICE 04: Quote for Dispatch (Reversed)
             ========================================================================= */}
          <div className="service-row-card grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/80 shadow-card">
            {/* Left: Dispatch Visual Card */}
            <div className="lg:col-span-5 relative h-72 rounded-2xl overflow-hidden shadow-md border border-slate-200 order-2 lg:order-1 bg-slate-900">
              <Image
                src="/images/hero-banner-3.png"
                alt="Global ocean freight and customs cleared shipping dispatch"
                fill
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover object-center brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold uppercase">
                  <Truck className="w-3.5 h-3.5" />
                  <span>PORT-TO-DOOR LOGISTICS</span>
                </div>
                <div className="text-sm font-display font-semibold">
                  Full Container Load (FCL) & Air Freight Cargo
                </div>
                <div className="text-xs text-slate-300">
                  Customs documentation, sealed crating, and marine transit insurance.
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-[#0d9488] uppercase">
                  04 / FREIGHT & LOGISTICS
                </span>
                <span className="text-4xl font-mono font-medium text-slate-100">04</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#090e17] tracking-tight">
                {SERVICES[3].title}
              </h3>

              <p className="text-base text-[#3f4f68] leading-relaxed">
                {SERVICES[3].description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-medium text-[#090e17]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Guaranteed Customs Clearance SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Anti-Corrosion Sealed Crating</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>Live Sea & Air Waybill Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0d9488]" />
                  <span>DDP / FOB / CIF Shipping Terms</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/enquiry?type=dispatch"
                  className="home-btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2"
                >
                  <span>Request Freight Quote</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
