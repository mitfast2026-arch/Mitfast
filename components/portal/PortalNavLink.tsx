'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export default function PortalNavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
  compact,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  badge?: number;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'portal-nav-link relative flex items-center gap-3 transition-colors',
        compact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5',
        active ? 'saas-nav-active' : 'saas-nav-inactive'
      )}
    >
      <div className={clsx('flex items-center gap-2.5 min-w-0', compact && 'justify-center')}>
        {Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden /> : null}
        {!compact ? <span className="truncate">{label}</span> : null}
      </div>
      {badge !== undefined && badge > 0 ? (
        <span
          className={clsx(
            'shrink-0 min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs font-mono text-center',
            compact && 'absolute -top-0.5 -right-0.5',
            active
              ? 'bg-portal-canvas text-portal-text'
              : 'bg-portal-accent text-portal-hero-text'
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
