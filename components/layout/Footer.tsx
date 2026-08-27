'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSettings } from '@/lib/client/settings-cache';

type SiteSettings = {
  companyName?: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  website?: string | null;
};

const PRODUCT_LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/products', label: 'Complete Catalog' },
  { href: '/categories', label: 'Product Categories' },
  { href: '/cart', label: 'RFQ Cart' },
  { href: '/enquiry', label: 'Custom Drawing Inquiry' },
] as const;

const SUPPLIER_LINKS = [
  { href: '/auth?role=supplier&mode=register', label: 'Supplier Onboarding' },
  { href: '/auth?role=supplier&mode=signin', label: 'Supplier Sign In' },
  { href: '/supplier/dashboard', label: 'Supplier Dashboard' },
] as const;

const ACCOUNT_LINKS = [
  { href: '/auth', label: 'Sign In' },
  { href: '/customer/dashboard', label: 'My Account' },
  { href: '/admin/dashboard', label: 'Admin Dashboard' },
] as const;

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-baseline gap-3 border-b border-white/15 py-2.5 text-[13px] text-white/90 transition-colors hover:border-teal-200/50 hover:text-white last:border-0"
    >
      <span className="font-mono text-[10px] text-teal-200/60 transition-colors group-hover:text-teal-200">
        →
      </span>
      <span>{label}</span>
    </Link>
  );
}

function LinkColumn({
  index,
  title,
  links,
}: {
  index: string;
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div className="min-w-0 rounded border border-white/15 bg-[#0B0F14]/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:p-6">
      <div className="mb-4 flex items-end gap-3 border-b border-white/20 pb-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-teal-200">{index}</span>
        <h3 className="font-display text-sm font-semibold tracking-wide text-white uppercase">
          {title}
        </h3>
      </div>
      <nav className="flex flex-col" aria-label={title}>
        {links.map((link) => (
          <FooterLink key={link.href + link.label} href={link.href} label={link.label} />
        ))}
      </nav>
    </div>
  );
}

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled && s) setSettings(s as any);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = settings?.companyName?.trim() || 'MITFAST';
  const email = settings?.businessEmail?.trim();
  const phone = settings?.businessPhone?.trim();
  const address = settings?.businessAddress?.trim();
  const website = settings?.website?.trim();

  return (
    <footer
      className="site-footer relative z-20 w-full overflow-hidden text-white bg-[#030507]"
      aria-label="Site footer"
    >
      {/* BG image — heavily darkened / desaturated */}
      <div
        className="pointer-events-none absolute inset-0 scale-105"
        style={{
          backgroundImage: 'url(/images/hero-banner-3.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.28) saturate(0.35) contrast(1.1)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/75 to-black/90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[#030507]/55"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-5 py-16 sm:px-8 md:py-24 lg:px-10">
        <div className="mb-12 flex flex-col gap-6 border-b border-white/25 pb-10 md:mb-14 md:flex-row md:items-end md:justify-between md:pb-12">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-teal-200">
                Precision sourcing
              </p>
              <span className="rounded-sm border border-white/35 bg-black/35 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur-sm">
                B2B
              </span>
            </div>
            <h2 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.9] tracking-[-0.04em] text-white">
              {companyName}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
              Marketplace for precision products, fasteners, and CNC parts — verified suppliers,
              inspection-backed orders.
            </p>
          </div>

          <div className="shrink-0 space-y-2 rounded border border-white/15 bg-[#0B0F14]/45 p-4 font-mono text-[11px] text-white/75 backdrop-blur-md md:min-w-[220px] md:text-right">
            {email && (
              <div>
                <a href={`mailto:${email}`} className="transition-colors hover:text-white">
                  {email}
                </a>
              </div>
            )}
            {phone && (
              <div>
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="transition-colors hover:text-white"
                >
                  {phone}
                </a>
              </div>
            )}
            {address && <div className="max-w-xs md:ml-auto">{address}</div>}
            {website && (
              <div>
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {!email && !phone && !address && !website && (
              <p className="text-white/55">B2B procurement platform</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <LinkColumn index="01" title="Products & Orders" links={PRODUCT_LINKS} />
          <LinkColumn index="02" title="Suppliers" links={SUPPLIER_LINKS} />
          <LinkColumn index="03" title="Account" links={ACCOUNT_LINKS} />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/25 pt-8 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] tracking-wide text-white/60">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
          <div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/65">
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
