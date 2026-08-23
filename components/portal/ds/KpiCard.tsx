'use client';

import React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

type Delta = {
  value: number;
  label?: string;
};

type KpiCardProps = {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: Delta;
  icon?: LucideIcon;
  href?: string;
  hero?: boolean;
  className?: string;
  onClick?: () => void;
};

function DeltaPill({ delta }: { delta: Delta }) {
  const positive = delta.value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        positive
          ? 'bg-portal-success-soft text-portal-success'
          : 'bg-portal-danger-soft text-portal-danger'
      )}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {Math.abs(delta.value)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  subtext = 'vs last period',
  delta,
  icon: Icon,
  href,
  hero = false,
  className,
  onClick,
}: KpiCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={clsx(
            'text-[13px] leading-snug capitalize',
            hero ? 'ds-hero-muted' : 'text-portal-muted'
          )}
        >
          {label}
        </p>
        {Icon ? (
          <span
            className={clsx(
              'h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 border',
              hero
                ? 'ds-hero-icon'
                : 'bg-portal-inset border-portal-border text-portal-accent'
            )}
            aria-hidden
          >
            <Icon className="w-4 h-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end gap-2 flex-wrap">
        <p
          className={clsx(
            'font-bold tabular-nums tracking-tight',
            hero
              ? 'text-[32px] sm:text-[40px] leading-none text-[#0A0A0A]'
              : 'type-kpi text-portal-text'
          )}
          style={hero ? { color: '#0A0A0A' } : undefined}
        >
          {value}
        </p>
        {delta !== undefined ? <DeltaPill delta={delta} /> : null}
      </div>
      {subtext ? (
        <p
          className={clsx(
            'mt-2 text-xs',
            hero ? 'ds-hero-muted' : 'text-portal-muted'
          )}
        >
          {subtext}
        </p>
      ) : null}
    </>
  );

  const base = clsx(
    hero ? 'saas-kpi-card-hero' : 'saas-kpi-card',
    'block transition-colors no-underline',
    (href || onClick) && (hero ? 'hover:opacity-95' : 'hover:bg-portal-hover'),
    className
  );

  if (href) {
    return (
      <Link href={href} className={base} style={hero ? { color: '#0A0A0A' } : undefined}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(base, 'w-full text-left')}
        style={hero ? { color: '#0A0A0A' } : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={base} style={hero ? { color: '#0A0A0A' } : undefined}>
      {content}
    </div>
  );
}

export function HeroKpiCard(props: Omit<KpiCardProps, 'hero'>) {
  return <KpiCard {...props} hero />;
}
