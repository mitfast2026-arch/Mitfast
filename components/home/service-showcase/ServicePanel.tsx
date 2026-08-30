'use client';

import React, { forwardRef } from 'react';
import Image from 'next/image';
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
        </div>
      </article>
    );
  },
);

export default ServicePanel;
