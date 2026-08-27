'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Star, ShieldCheck, Quote, CheckCircle2, Award } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TESTIMONIALS } from '@/lib/home/content';

gsap.registerPlugin(ScrollTrigger);

const METRIC_TAGS = [
  { metric: '58% Lead Time Drop', detail: 'Reduced fastener turnaround from 12 weeks to 5' },
  { metric: 'Zero Tolerance Defect', detail: 'Locked CAD pricing with 100% CMM acceptance' },
  { metric: '100% Batch Traceability', detail: 'Factory-direct stock with EN 10204 3.1 certs' },
];

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from('.testimonial-exec-card', {
        y: 35,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: cardsRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="relative bg-white py-24 md:py-36 border-b border-slate-200/80 overflow-hidden"
      aria-label="Executive Leadership Endorsements"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#090e17] text-xs font-semibold tracking-wider uppercase">
            <Award className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>03 / ENDORSEMENTS</span>
            <span className="h-1 w-1 rounded-full bg-[#0d9488]" />
            <span>VERIFIED PROCUREMENT EXECUTIVES</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#090e17]">
            Trusted by procurement leaders.
            <br />
            <span className="text-[#718096] font-normal">Across manufacturing sectors.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#3f4f68] max-w-2xl mx-auto leading-relaxed">
            See how procurement teams rely on MITFAST for factory-direct pricing, RFQs, and quality-certified orders.
          </p>
        </div>

        {/* 3 Master Executive Testimonial Cards */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {TESTIMONIALS.map((item, idx) => {
            const metric = METRIC_TAGS[idx] || METRIC_TAGS[0];

            return (
              <div
                key={item.name}
                className="testimonial-exec-card home-card-soft p-8 sm:p-10 flex flex-col justify-between space-y-8 bg-[#f8f9fb] border border-slate-200/80 relative"
              >
                <div className="space-y-6">
                  {/* Top Metric & Rating Row */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-[#0f766e] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                      VERIFIED BUYER
                    </span>
                  </div>

                  {/* Quote Narrative */}
                  <blockquote className="font-display text-lg sm:text-xl text-[#090e17] font-semibold leading-snug tracking-tight">
                    “{item.quote}”
                  </blockquote>

                  {/* Impact Metric Pill */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-0.5 shadow-2xs">
                    <div className="text-xs font-bold text-[#0d9488]">
                      {metric.metric}
                    </div>
                    <div className="text-[11px] text-[#718096]">
                      {metric.detail}
                    </div>
                  </div>
                </div>

                {/* Author Info */}
                <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-xs shrink-0">
                    <Image
                      src={item.photo}
                      alt={item.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm text-[#090e17]">
                      {item.name}
                    </div>
                    <div className="text-xs text-[#3f4f68]">
                      {item.role}
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      {item.company}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Trust & Compliance Ribbon */}
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-700 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0d9488]" />
            <span>ISO 9001:2015 Certified Plants</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0d9488]" />
            <span>AS9100D Aerospace Traceability</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0d9488]" />
            <span>EN 10204 3.1 Inspection Gates</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0d9488]" />
            <span>IATF 16949 Automotive Standard</span>
          </div>
        </div>
      </div>
    </section>
  );
}
