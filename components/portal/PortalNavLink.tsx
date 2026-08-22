'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export default function PortalNavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`portal-nav-link flex items-center justify-between px-3 py-2.5 rounded-full text-xs transition-colors ${
        active ? 'saas-nav-active' : 'saas-nav-inactive'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? <Icon className="w-4 h-4" /> : null}
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[11px] font-mono text-center ${
            active ? 'bg-white text-[#111315]' : 'bg-[#111315] text-white'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
