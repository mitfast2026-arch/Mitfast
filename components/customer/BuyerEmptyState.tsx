'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export type BuyerEmptyVariant =
  | 'orders'
  | 'quotes'
  | 'activity'
  | 'wishlist'
  | 'enquiries'
  | 'rfqs'
  | 'notifications'
  | 'search';

type BuyerEmptyStateProps = {
  variant: BuyerEmptyVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  compact?: boolean;
  action?: React.ReactNode;
};

function EmptyArt({ variant }: { variant: BuyerEmptyVariant }) {
  const accent =
    variant === 'wishlist'
      ? '#FEE2E2'
      : variant === 'quotes' || variant === 'enquiries' || variant === 'rfqs'
        ? '#EEF2FF'
        : variant === 'activity'
          ? '#FEF3C7'
          : '#E8EAED';

  const stroke =
    variant === 'wishlist'
      ? '#B91C1C'
      : variant === 'quotes' || variant === 'enquiries' || variant === 'rfqs'
        ? '#3730A3'
        : variant === 'activity'
          ? '#B45309'
          : '#111111';

  return (
    <div className="buyer-empty-art" style={{ ['--empty-accent' as string]: accent }}>
      <svg
        viewBox="0 0 120 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="buyer-empty-svg"
        aria-hidden
      >
        <rect x="8" y="20" width="104" height="68" rx="12" fill="#f7f7f8" />
        <rect x="8" y="20" width="104" height="68" rx="12" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.15" />
        {variant === 'orders' && (
          <>
            <path
              d="M36 44h48M36 56h32M36 68h40"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.35"
            />
            <rect x="28" y="32" width="28" height="20" rx="4" fill={accent} stroke={stroke} strokeWidth="1.5" strokeOpacity="0.4" />
            <path d="M34 42l6 6 12-12" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {variant === 'quotes' && (
          <>
            <rect x="32" y="34" width="56" height="44" rx="6" fill={accent} stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" />
            <path d="M42 48h36M42 58h28M42 68h20" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.45" />
            <circle cx="82" cy="38" r="10" fill="#111111" fillOpacity="0.08" />
            <path d="M78 38h8M82 34v8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {variant === 'wishlist' && (
          <>
            <path
              d="M60 78c-14-10-24-18-24-30 0-8 6-14 14-14 6 0 10 4 10 4s4-4 10-4c8 0 14 6 14 14 0 12-10 20-24 30z"
              fill={accent}
              stroke={stroke}
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            <circle cx="88" cy="30" r="6" fill={stroke} fillOpacity="0.12" />
          </>
        )}
        {variant === 'activity' && (
          <>
            <circle cx="44" cy="52" r="16" fill={accent} stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" />
            <path d="M44 44v8l6 4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M68 40c6 4 10 10 10 18" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
            <circle cx="78" cy="36" r="4" fill={stroke} fillOpacity="0.2" />
          </>
        )}
        {(variant === 'enquiries' || variant === 'rfqs') && (
          <>
            <rect x="34" y="36" width="52" height="40" rx="5" fill={accent} stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" />
            <path d="M44 50h32M44 60h24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.4" />
            <path d="M78 68l8 8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
            <circle cx="72" cy="62" r="10" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
          </>
        )}
        {variant === 'notifications' && (
          <>
            <path
              d="M60 34c-10 0-18 8-18 18v8l-4 6h44l-4-6v-8c0-10-8-18-18-18z"
              fill={accent}
              stroke={stroke}
              strokeWidth="1.5"
              strokeOpacity="0.4"
            />
            <circle cx="76" cy="38" r="6" fill="#B91C1C" fillOpacity="0.85" />
            <path d="M52 72c2 4 6 6 8 6s6-2 8-6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.35" />
          </>
        )}
        {variant === 'search' && (
          <>
            <circle cx="52" cy="52" r="18" stroke={stroke} strokeWidth="2.5" strokeOpacity="0.35" fill={accent} />
            <path d="M64 64l14 14" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.45" />
            <path d="M46 52h12M52 46v12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.25" />
          </>
        )}
      </svg>
    </div>
  );
}

const defaults: Record<
  BuyerEmptyVariant,
  { title: string; description: string; actionLabel?: string; actionHref?: string }
> = {
  orders: {
    title: 'No orders yet',
    description: 'Approved RFQs become orders you can track here.',
    actionLabel: 'Browse catalog',
    actionHref: '/products',
  },
  quotes: {
    title: 'No quotes yet',
    description: 'Add items to cart or send an enquiry to receive pricing.',
    actionLabel: 'Open cart',
    actionHref: '/cart',
  },
  activity: {
    title: 'Nothing recent',
    description: 'Order and quote updates will appear here as they happen.',
  },
  wishlist: {
    title: 'Wishlist is empty',
    description: 'Save products from the catalog to request quotes later.',
    actionLabel: 'Browse catalog',
    actionHref: '/products',
  },
  enquiries: {
    title: 'No enquiries yet',
    description: 'Submit a drawing or off-catalog request to get started.',
    actionLabel: 'Send enquiry',
    actionHref: '/enquiry',
  },
  rfqs: {
    title: 'No RFQs yet',
    description: 'Add products to cart and request a quote from the catalog.',
    actionLabel: 'Browse catalog',
    actionHref: '/products',
  },
  notifications: {
    title: 'No notifications',
    description: 'Alerts about orders, quotes, and account activity will show here.',
  },
  search: {
    title: 'No matching results',
    description: 'Try clearing search or filters to see more items.',
  },
};

export function BuyerEmptyState({
  variant,
  title,
  description,
  actionLabel,
  actionHref,
  compact = false,
  action,
}: BuyerEmptyStateProps) {
  const preset = defaults[variant];
  const resolvedTitle = title ?? preset.title;
  const resolvedDesc = description ?? preset.description;
  const resolvedLabel = actionLabel ?? preset.actionLabel;
  const resolvedHref = actionHref ?? preset.actionHref;

  return (
    <div className={compact ? 'buyer-empty buyer-empty--compact' : 'buyer-empty'}>
      <EmptyArt variant={variant} />
      <h3 className="buyer-empty-title">{resolvedTitle}</h3>
      <p className="buyer-empty-desc">{resolvedDesc}</p>
      {action ??
        (resolvedLabel && resolvedHref ? (
          <Link href={resolvedHref} className="buyer-cta mt-1">
            {resolvedLabel}
          </Link>
        ) : null)}
    </div>
  );
}

export function BuyerStatIcon({
  icon: Icon,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'orders' | 'cart' | 'wishlist' | 'quotes';
}) {
  return (
    <span className={`buyer-icon-well buyer-icon-well--${tone}`}>
      <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}
