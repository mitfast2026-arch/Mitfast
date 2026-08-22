'use client';

import React, { forwardRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ServiceShowcaseItem } from './data';

interface ServicePanelProps {
  service: ServiceShowcaseItem;
  mediaRef?: React.Ref<HTMLDivElement>;
  variant?: 'desktop' | 'mobile';
}

const ServicePanel = forwardRef<HTMLDivElement, ServicePanelProps>(
  function ServicePanel({ service, mediaRef, variant = 'desktop' }, ref) {
    return (
      <article
        ref={ref}
        className="service-panel"
        data-service-id={service.id}
        aria-labelledby={`service-title-${service.id}`}
      >
        <div className="service-panel__media-wrap">
          <div ref={mediaRef} className="service-panel__media-inner">
            <Image
              src={service.image}
              alt={service.title}
              fill
              sizes={
                variant === 'mobile'
                  ? '100vw'
                  : '(max-width: 1280px) 62vw, 720px'
              }
              className="object-cover"
              style={{ objectPosition: service.objectPosition }}
              priority={service.number === '01'}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#111315]/80 via-transparent to-[#111315]/30 pointer-events-none" />
        </div>

        <div className="service-panel__content">
          <p className="service-panel__meta">{service.tag}</p>
          <h3
            id={`service-title-${service.id}`}
            className="service-panel__title"
          >
            {service.title}
          </h3>
          <p className="service-panel__subtitle">{service.subtitle}</p>
          <p className="service-panel__description">{service.description}</p>
          <Link
            href={service.ctaHref}
            className="inline-flex items-center gap-3 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white hover:text-[#111315] border border-white/20 hover:border-white px-6 py-3.5 rounded-xl transition-all duration-300 shadow-md group"
          >
            <span>{service.ctaText}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </div>
      </article>
    );
  },
);

export default ServicePanel;
