'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import gsap from 'gsap';
import { useBodyScrollLock } from '@/lib/client/use-body-scroll-lock';
import type { ServiceShowcaseItem } from '@/components/home/service-showcase/data';

type Props = {
  item: ServiceShowcaseItem;
  onClose: () => void;
};

function ctaLabel(href: string) {
  return href.startsWith('/enquiry') ? 'Send Enquiry' : 'Browse Catalog';
}

export default function ServiceDetailPanel({ item, onClose }: Props) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const Icon = item.icon;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panel = panelRef.current;
    const root = rootRef.current;

    if (reduce || !panel) {
      onClose();
      return;
    }

    gsap.to(root?.querySelector('.svc-detail-backdrop') ?? null, {
      opacity: 0,
      duration: 0.2,
      ease: 'power1.in',
    });
    gsap.to(panel, {
      opacity: 0,
      y: 10,
      duration: 0.22,
      ease: 'power1.in',
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panel = panelRef.current;

    let tween: gsap.core.Tween | undefined;
    if (panel) {
      if (reduce) {
        gsap.set(panel, { opacity: 1, y: 0 });
      } else {
        gsap.set(panel, { opacity: 0, y: 12 });
        tween = gsap.to(panel, {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: 'power2.out',
        });
      }
    }

    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    }

    function onFocusTrap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onFocusTrap);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onFocusTrap);
      tween?.kill();
    };
  }, [item.id, requestClose]);

  useBodyScrollLock(true);

  return (
    <div ref={rootRef} className="svc-detail-root" role="presentation">
      <button
        type="button"
        className="svc-detail-backdrop"
        aria-label="Close service details"
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        className="svc-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="svc-detail-media">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 900px) 100vw, 560px"
            style={{ objectPosition: item.objectPosition }}
            priority
          />
        </div>

        <div className="svc-detail-body">
          <button
            ref={closeRef}
            type="button"
            className="svc-detail-close"
            aria-label="Close"
            onClick={requestClose}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="svc-detail-icon" aria-hidden>
            <Icon className="w-5 h-5" strokeWidth={1.5} />
          </div>

          <h2 id={titleId} className="svc-detail-title">
            {item.title}
          </h2>
          <p className="svc-detail-subtitle">{item.subtitle}</p>

          <span className="svc-detail-badge">{item.badge}</span>

          <p className="svc-detail-desc">{item.description}</p>

          <div className="svc-detail-actions">
            <Link href={item.ctaHref} className="svc-detail-cta">
              <span>{ctaLabel(item.ctaHref)}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
