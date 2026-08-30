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

  return (
    <section className="relative z-10 w-full min-h-[max(600px,100svh)] sm:min-h-[max(660px,100svh)] lg:min-h-[max(780px,100svh)] max-h-[1150px] flex flex-col justify-end lg:justify-center items-center lg:items-start">
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {list.map((s, i) => (
          <div
            key={s.id}
            className="cinematic-hero-slide absolute inset-0 w-full h-full transition-opacity duration-700"
            style={{
              backgroundImage: `url('${s.imageUrl}')`,
              opacity: i === index ? 1 : 0,
            }}
            aria-hidden={i !== index}
          />
        ))}
        {/* Mobile + Tablet bottom gradient to provide pristine contrast for white text at bottom (<1024px) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent lg:hidden pointer-events-none" />
      </div>

      <div className="w-full max-w-[1700px] mx-auto px-6 sm:px-12 lg:px-20 relative z-20 pt-28 sm:pt-36 pb-14 sm:pb-16 lg:pb-12 flex-1 flex flex-col justify-end lg:justify-center items-center lg:items-start text-center lg:text-left">
        <div className="relative max-w-xl sm:max-w-2xl space-y-4 sm:space-y-6 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="relative z-10 space-y-4 sm:space-y-6 flex flex-col items-center lg:items-start text-center lg:text-left w-full">
            <h1 className="hero-text-card font-heading font-bold tracking-tight text-white lg:text-[#111315] leading-[1.05] text-center lg:text-left">
              {renderTitle(slide.title)}
            </h1>

            {slide.subtitle ? (
              <p className="text-sm sm:text-base text-white/90 lg:text-[#1F2429] leading-relaxed max-w-md font-normal text-center lg:text-left">
                {slide.subtitle}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-1 sm:pt-2">
              {slide.cta1Label && slide.cta1Href ? (
                <Link
                  href={slide.cta1Href}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-white text-[#111315] hover:bg-white/90 lg:bg-[#111315] lg:text-white lg:hover:bg-[#1F2429] text-xs sm:text-sm font-semibold transition-all shadow-md group"
                >
                  <span>{slide.cta1Label}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
              ) : null}

              {slide.cta2Label && slide.cta2Href ? (
                <Link
                  href={slide.cta2Href}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-md lg:bg-white/95 lg:text-[#111315] lg:border-[#111315]/20 lg:hover:border-[#111315]/40 text-xs sm:text-sm font-semibold transition-all shadow-sm group"
                >
                  <span>{slide.cta2Label}</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              ) : null}
            </div>

            {list.length > 1 ? (
              <div className="flex items-center justify-center lg:justify-start gap-2 pt-2" aria-label="Hero slides">
                {list.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Show slide ${i + 1}`}
                    aria-current={i === index}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? 'w-6 bg-white lg:bg-[#111315]'
                        : 'w-1.5 bg-white/40 hover:bg-white/70 lg:bg-[#111315]/35 lg:hover:bg-[#111315]/55'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
