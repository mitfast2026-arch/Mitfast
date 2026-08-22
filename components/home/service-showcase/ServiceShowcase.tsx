'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import StickyServiceNav from './StickyServiceNav';
import ServicePanel from './ServicePanel';
import {
  SERVICE_SHOWCASE_HEADLINE,
  serviceShowcaseItems,
} from './data';
import './service-showcase.css';

gsap.registerPlugin(ScrollTrigger);

export default function ServiceShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const desktopPanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobilePanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToPanel = useCallback((index: number) => {
    const panel = desktopPanelRefs.current[index];
    if (!panel) return;
    const lenis = (
      window as unknown as {
        __lenis?: { scrollTo: (t: number, o?: object) => void };
      }
    ).__lenis;
    const rect = panel.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY =
      scrollTop + rect.top - Math.max(20, (window.innerHeight - rect.height) / 2);
    if (lenis) {
      lenis.scrollTo(targetY, { offset: 0, duration: 1.15 });
    } else {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, []);

  useGSAP(
    () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        const panels = desktopPanelRefs.current.filter(Boolean) as HTMLDivElement[];

        panels.forEach((panel, i) => {
          ScrollTrigger.create({
            trigger: panel,
            start: 'top 50%',
            end: 'bottom 50%',
            onEnter: () => setActiveIndex(i),
            onEnterBack: () => setActiveIndex(i),
          });

          if (reduce) return;

          gsap.fromTo(
            panel,
            { opacity: 0.3, y: 36, scale: 0.95 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: panel,
                start: 'top 85%',
                end: 'top 40%',
                scrub: 0.25,
              },
            },
          );

          gsap.fromTo(
            panel,
            { opacity: 1, y: 0, scale: 1 },
            {
              opacity: 0.3,
              y: -24,
              scale: 0.95,
              ease: 'power2.in',
              scrollTrigger: {
                trigger: panel,
                start: 'bottom 60%',
                end: 'bottom 15%',
                scrub: 0.25,
              },
            },
          );

          const media = mediaRefs.current[i];
          if (media) {
            gsap.to(media, {
              yPercent: 8,
              scale: 1.05,
              ease: 'none',
              scrollTrigger: {
                trigger: panel,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            });
          }
        });
      });

      mm.add('(max-width: 1023px)', () => {
        if (reduce) return;

        mobilePanelRefs.current.forEach((panel) => {
          if (!panel) return;
          gsap.from(panel, {
            y: 28,
            opacity: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: panel,
              start: 'top 88%',
              once: true,
            },
          });
        });
      });

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef },
  );

  const setDesktopPanelRef = (index: number) => (el: HTMLDivElement | null) => {
    desktopPanelRefs.current[index] = el;
  };

  const setMobilePanelRef = (index: number) => (el: HTMLDivElement | null) => {
    mobilePanelRefs.current[index] = el;
  };

  const setMediaRef = (index: number) => (el: HTMLDivElement | null) => {
    mediaRefs.current[index] = el;
  };

  return (
    <section
      ref={sectionRef}
      id="services"
      className="service-showcase relative z-10 w-full overflow-x-clip"
      aria-label="MITFAST procurement services"
    >
      <div className="service-showcase__grid relative z-20">
        <aside className="service-showcase__nav-col">
          <StickyServiceNav
            activeIndex={activeIndex}
            onSelect={scrollToPanel}
          />
        </aside>

        <div className="service-showcase__track-col">
          {serviceShowcaseItems.map((service, index) => (
            <ServicePanel
              key={service.id}
              ref={setDesktopPanelRef(index)}
              service={service}
              mediaRef={setMediaRef(index)}
              variant="desktop"
            />
          ))}
        </div>
      </div>

      <div className="service-showcase__mobile relative z-20">
        <div className="service-showcase__mobile-intro space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6B7280]">
            {SERVICE_SHOWCASE_HEADLINE.eyebrow}
          </p>
          <h2 className="text-3xl font-bold leading-[1.12] tracking-tight text-[#F7F7F8]">
            {SERVICE_SHOWCASE_HEADLINE.title}{' '}
            <span className="font-display font-normal italic text-[#D7D9DC]">
              {SERVICE_SHOWCASE_HEADLINE.titleAccent}
            </span>
            <br />
            {SERVICE_SHOWCASE_HEADLINE.titleLine2}
          </h2>
          <p className="text-sm leading-relaxed text-[#9CA3AF]">
            {SERVICE_SHOWCASE_HEADLINE.subtitle}
          </p>
        </div>

        {serviceShowcaseItems.map((service, index) => (
          <div key={service.id} className="service-showcase__mobile-panel">
            <ServicePanel
              ref={setMobilePanelRef(index)}
              service={service}
              variant="mobile"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
