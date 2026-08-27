'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react';
import { TESTIMONIALS, type TestimonialItem } from '@/lib/home/content';

type RatingSummary = {
  score: string;
  label: string;
};

type FloatingTestimonialsProps = {
  items?: TestimonialItem[];
  heading?: [string, string];
  ratingSummary?: RatingSummary;
};

const DEFAULT_HEADING: [string, string] = [
  'Verified buyer references.',
  'Source with confidence.',
];

const DEFAULT_RATING: RatingSummary = {
  score: '4.9/5',
  label: 'Based on verified buyer feedback',
};

const DRAG_THRESHOLD = 8;
const CARD_GAP_PX = 24;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function QuoteMark() {
  return (
    <svg
      width="48"
      height="38"
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden
      className="text-[#D7D9DC]"
    >
      <path
        d="M0 40V22.4C0 10.08 6.72 2.24 18.24 0L21.12 6.72C14.4 8.96 11.52 13.44 11.52 20.16H21.12V40H0ZM26.88 40V22.4C26.88 10.08 33.6 2.24 45.12 0L48 6.72C41.28 8.96 38.4 13.44 38.4 20.16H48V40H26.88Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TestimonialAvatar({ item }: { item: TestimonialItem }) {
  const [usePhoto, setUsePhoto] = useState(false);
  const initials = getInitials(item.name);

  useEffect(() => {
    if (!item.photo) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setUsePhoto(true);
    };
    img.onerror = () => {
      if (!cancelled) setUsePhoto(false);
    };
    img.src = item.photo;
    return () => {
      cancelled = true;
    };
  }, [item.photo]);

  if (!usePhoto) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E2E4E8] bg-[#ECEEF0] text-xs font-semibold tracking-wide text-[#111315]"
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#E2E4E8] bg-[#ECEEF0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.photo} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  // 1 / ~2 / exactly 3 across the carousel viewport (gap = 24px)
  const widthClass =
    'testimonial-card flex h-full shrink-0 snap-start flex-col w-full sm:w-[calc((100%-24px)*0.5)] lg:w-[calc((100%-48px)*0.333333)]';

  return (
    <article className={widthClass}>
      <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-[#E2E4E8] bg-white p-8">
        <p className="flex-1 text-[17px] leading-[1.6] text-[#111315] sm:text-lg sm:leading-[1.6]">
          {item.quote}
        </p>

        <div
          className="mt-6 flex items-center gap-1"
          aria-label={`${item.rating} out of 5 stars`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < item.rating
                  ? 'h-[18px] w-[18px] fill-[#15803D] text-[#15803D]'
                  : 'h-[18px] w-[18px] fill-transparent text-[#D7D9DC]'
              }
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3.5 border-t border-[#E2E4E8] pt-5">
          <TestimonialAvatar item={item} />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[#111315]">{item.name}</div>
            <div className="mt-0.5 truncate text-sm leading-snug text-[#6B7280]">
              {item.role} · {item.relativeDate}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FloatingTestimonials({
  items = TESTIMONIALS,
  heading = DEFAULT_HEADING,
  ratingSummary = DEFAULT_RATING,
}: FloatingTestimonialsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    axis: null as null | 'x' | 'y',
    active: false,
  });
  const [progress, setProgress] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [dragging, setDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = max > 0 ? el.scrollLeft / max : 0;
    setProgress(Math.min(1, Math.max(0, ratio)));
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, items]);

  const getCardStep = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 400;
    const card = el.querySelector<HTMLElement>('.testimonial-card');
    if (!card) return 400;
    return card.offsetWidth + CARD_GAP_PX;
  }, []);

  const scrollByCards = useCallback(
    (dir: -1 | 1) => {
      const el = trackRef.current;
      if (!el) return;
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      el.scrollBy({ left: dir * getCardStep(), behavior });
    },
    [getCardStep],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      axis: null,
      active: true,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    const state = dragState.current;
    if (!el || !state.active || state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (state.axis === null) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        state.active = false;
        state.axis = 'y';
        setDragging(false);
        return;
      }
      state.axis = 'x';
      setDragging(true);
      el.setPointerCapture(e.pointerId);
    }

    if (state.axis !== 'x') return;
    e.preventDefault();
    el.scrollLeft = state.scrollLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    const state = dragState.current;
    if (!state.active && state.axis !== 'x') {
      state.pointerId = -1;
      state.axis = null;
      return;
    }
    if (state.pointerId !== e.pointerId) return;
    const wasHorizontal = state.axis === 'x';
    state.active = false;
    state.axis = null;
    state.pointerId = -1;
    setDragging(false);
    if (wasHorizontal && el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  };

  return (
    <section
      id="testimonials"
      className="relative z-10 w-full bg-[#F7F7F8] py-16 sm:py-20 lg:py-24"
      aria-label="Buyer testimonials"
    >
      {/* Full-width — only 40–60px side padding */}
      <div className="w-full px-10 sm:px-12 lg:px-[60px]">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#111315] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
            {heading[0]}
            <br />
            {heading[1]}
          </h2>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm text-[#6B7280] sm:text-[15px]">
            <span className="text-base font-semibold tabular-nums text-[#111315]">
              {ratingSummary.score}
            </span>
            <span className="inline-flex items-center gap-1" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#15803D] text-[#15803D]" />
              ))}
            </span>
            <span>{ratingSummary.label}</span>
          </div>
        </header>

        {/* 25% intro · 75% three-card carousel */}
        <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-14 lg:grid-cols-[25%_minmax(0,1fr)] lg:items-center lg:gap-10">
          <div className="flex flex-col lg:pr-2">
            <QuoteMark />
            <h3 className="mt-5 text-2xl font-semibold leading-snug tracking-tight text-[#111315]">
              What procurement teams are saying
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#6B7280]">
              Buyer feedback from manufacturing and precision engineering teams who
              buy and source through MITFAST.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                disabled={!canPrev}
                aria-label="Previous testimonials"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E2E4E8] bg-white text-[#111315] shadow-sm transition-colors hover:border-[#111315] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </button>

              <div
                className="relative h-[2px] w-16 shrink-0 overflow-hidden rounded-full bg-[#E2E4E8]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label="Carousel progress"
              >
                <div
                  className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#111315] transition-[transform] duration-300 ease-out"
                  style={{ transform: `translateX(${progress * 100}%)` }}
                />
              </div>

              <button
                type="button"
                onClick={() => scrollByCards(1)}
                disabled={!canNext}
                aria-label="Next testimonials"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E2E4E8] bg-white text-[#111315] shadow-sm transition-colors hover:border-[#111315] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="relative min-w-0 overflow-hidden">
            <div
              ref={trackRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={`flex items-stretch gap-6 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${ dragging ? 'cursor-grabbing select-none !scroll-auto' : 'cursor-grab' }`}
              style={{
                scrollSnapType: dragging ? 'none' : 'x mandatory',
                touchAction: 'pan-x pan-y',
              }}
              data-lenis-prevent-touch
            >
              {items.map((item) => (
                <TestimonialCard key={`${item.name}-${item.company}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
