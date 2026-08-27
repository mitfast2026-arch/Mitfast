'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';
import {
  SERVICE_SHOWCASE_HEADLINE,
  serviceShowcaseItems,
  type ServiceShowcaseItem,
} from '@/components/home/service-showcase/data';
import ServiceDetailPanel from './ServiceDetailPanel';
import '@/app/services/services.css';

export default function ServicesEnquiryGrid() {
  const rootRef = useRef<HTMLElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<ServiceShowcaseItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useGSAP(
    () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cells = cellRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (!cells.length) return;

      if (reduce) {
        gsap.set(cells, { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        cells,
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.06,
          ease: 'power2.out',
        },
      );
    },
    { scope: rootRef },
  );

  const openDetail = useCallback((item: ServiceShowcaseItem, el: HTMLButtonElement) => {
    openerRef.current = el;
    setSelected(item);
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() => {
      openerRef.current?.focus();
    });
  }, []);

  return (
    <section
      ref={rootRef}
      className="svc-page"
      aria-label="MITFAST procurement services"
    >
      <h1 className="sr-only">
        {SERVICE_SHOWCASE_HEADLINE.title}{' '}
        {SERVICE_SHOWCASE_HEADLINE.titleAccent}{' '}
        {SERVICE_SHOWCASE_HEADLINE.titleLine2}
      </h1>

      <div className={`svc-grid${hovered !== null ? ' is-interacting' : ''}`}>
        {serviceShowcaseItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            ref={(el) => {
              cellRefs.current[index] = el;
            }}
            className={`svc-cell${hovered === index ? ' is-hovered' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={selected?.id === item.id}
            onClick={(e) => openDetail(item, e.currentTarget)}
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
          >
            <div className="svc-cell__media">
              <Image
                src={item.image}
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                style={{ objectPosition: item.objectPosition }}
                priority={index < 2}
              />
            </div>
            <div className="svc-cell__scrim" />
            <span className="svc-cell__brand">MITFAST</span>
            <div className="svc-cell__content">
              <p className="svc-cell__meta">
                <span className="svc-cell__number">{item.number}</span>
                {item.tag}
              </p>
              <h2 className="svc-cell__title">{item.title}</h2>
              <p className="svc-cell__subtitle">{item.subtitle}</p>
              <span className="svc-cell__action">
                <span className="svc-cell__action-line" aria-hidden />
                View details
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </span>
            </div>
          </button>
        ))}
      </div>

      {mounted &&
        selected &&
        createPortal(
          <ServiceDetailPanel
            item={selected}
            onClose={closeDetail}
          />,
          document.body,
        )}
    </section>
  );
}
