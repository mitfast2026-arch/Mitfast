'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export type HeroSlideView = {
  id: string;
  imageUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta1Label: string;
  cta1Href: string;
  cta2Label: string;
  cta2Href: string;
};

type HeroStats = {
  productCount: number;
  categoryCount: number;
};

const FALLBACK_SLIDE: HeroSlideView = {
  id: 'fallback',
  imageUrl: '/images/homepage_banner_1.png',
  eyebrow: 'B2B SOURCING. FACTORY-DIRECT PRICING.',
  title: 'B2B Procurement.\nMade Simple.',
  subtitle:
    'Buy precision components, request quotes, and place orders from verified suppliers — all in one B2B marketplace.',
  cta1Label: 'Explore Services',
  cta1Href: '/#services',
  cta2Label: 'Get a Quote',
  cta2Href: '/enquiry',
};

function renderTitle(title: string) {
  const parts = title.split('\n').filter((p) => p.length > 0);
  if (parts.length <= 1) {
    return title;
  }
  return (
    <>
      {parts.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))}
    </>
  );
}

export default function CinematicHero({
  stats,
  slides,
}: {
  stats?: HeroStats;
  slides?: HeroSlideView[];
}) {
  const list = slides && slides.length > 0 ? slides : [FALLBACK_SLIDE];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [list.length]);

  const slide = list[Math.min(index, list.length - 1)] || FALLBACK_SLIDE;

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
      {list.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat z-0 transition-opacity duration-700"
          style={{
            backgroundImage: `url('${s.imageUrl}')`,
            backgroundPosition: 'center center',
            opacity: i === index ? 1 : 0,
          }}
          aria-hidden={i !== index}
        />
      ))}

      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pt-28 sm:pt-36 pb-6 flex-1 flex flex-col justify-center items-start text-left">
        <div className="max-w-xl space-y-6">
          {slide.eyebrow ? (
            <div className="text-[11px] sm:text-xs font-medium tracking-[0.25em] text-[#2A3036] uppercase flex items-center gap-2">
              <span className="w-2 h-[2px] bg-[#111315]" />
              <span>{slide.eyebrow}</span>
            </div>
          ) : null}

          <h1 className="font-heading text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-tight text-[#111315] leading-[1.05]">
            {renderTitle(slide.title)}
          </h1>

          {slide.subtitle ? (
            <p className="text-sm sm:text-base text-[#1F2429] leading-relaxed max-w-md font-normal">
              {slide.subtitle}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            {slide.cta1Label && slide.cta1Href ? (
              <Link
                href={slide.cta1Href}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#111315] hover:bg-[#1F2429] text-white text-xs sm:text-sm font-semibold transition-all shadow-md group"
              >
                <span>{slide.cta1Label}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            ) : null}

            {slide.cta2Label && slide.cta2Href ? (
              <Link
                href={slide.cta2Href}
                className="liquid-glass-btn inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-[#111315] group"
              >
                <span>{slide.cta2Label}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            ) : null}
          </div>

          {list.length > 1 ? (
            <div className="flex items-center gap-2 pt-2" aria-label="Hero slides">
              {list.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Show slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-[#111315]' : 'w-1.5 bg-[#111315]/35 hover:bg-[#111315]/55'
                  }`}
                />
              ))}
            </div>
          ) : null}
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
