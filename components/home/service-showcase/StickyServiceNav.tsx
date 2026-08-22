'use client';

import React from 'react';
import {
  SERVICE_SHOWCASE_HEADLINE,
  serviceShowcaseItems,
} from './data';

interface StickyServiceNavProps {
  activeIndex: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export default function StickyServiceNav({
  activeIndex,
  onSelect,
  className = '',
}: StickyServiceNavProps) {
  const { eyebrow, title, titleAccent, titleLine2, subtitle } =
    SERVICE_SHOWCASE_HEADLINE;

  return (
    <nav
      className={`flex flex-col justify-center space-y-8 lg:space-y-12 ${className}`}
      aria-label="Service navigation"
    >
      <div className="space-y-5 lg:space-y-6">
        <div className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-[0.25em] text-[#9CA3AF]">
          <span className="w-2 h-[2px] bg-white rounded-full" />
          <span>{eyebrow}</span>
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-black leading-[1.05] tracking-[-0.035em] text-[#F7F7F8]">
          {title}{' '}
          <span className="font-display font-normal italic tracking-normal text-[#D7D9DC]">
            {titleAccent}
          </span>
          <br />
          {titleLine2}
        </h2>

        <p className="text-base sm:text-[17px] leading-relaxed text-[#A1A7B3] max-w-lg hidden lg:block font-normal">
          {subtitle}
        </p>
      </div>

      <ul className="space-y-2.5 pt-2" role="list">
        {serviceShowcaseItems.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`service-nav-item${isActive ? ' service-nav-item--active' : ''}`}
                onClick={() => onSelect?.(index)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="service-nav-item__num">{item.number}</span>
                <span className="service-nav-item__bar" aria-hidden="true" />
                <span className="service-nav-item__label">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
