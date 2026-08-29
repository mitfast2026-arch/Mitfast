'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { getSettings } from '@/lib/client/settings-cache';

type SiteSettings = {
  companyName?: string;
  logoUrl?: string | null;
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

const focusRing =
  'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D7D9DC]';

function FooterCTA() {
  return (
    <div className="border-b border-white/10 pb-10 md:pb-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#D7D9DC]/80">
            Precision sourcing · B2B
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            Source verified parts. Request a quote in minutes.
          </h2>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/enquiry"
            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#111315] transition-colors hover:bg-[#ECEEF0] ${focusRing}`}
          >
            Get a Quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/products"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/45 hover:bg-white/5 ${focusRing}`}
          >
            Explore Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}

function FooterNavColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
        {title}
      </h3>
      <nav className="flex flex-col gap-1" aria-label={title}>
        {links.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className={`group flex items-center gap-2 py-1.5 text-sm text-white/80 transition-[color,transform] duration-200 hover:text-white motion-reduce:transition-none motion-reduce:hover:translate-x-0 ${focusRing}`}
          >
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-[#D7D9DC]/0 transition-all duration-200 group-hover:text-[#D7D9DC] motion-reduce:transition-none"
              aria-hidden
            />
            <span className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              {link.label}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function FooterContact({
  email,
  phone,
  address,
  website,
}: {
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}) {
  const hasContact = email || phone || address || website;
  if (!hasContact) {
    return (
      <p className="text-sm text-white/55">
        B2B procurement platform for precision fasteners, CNC parts, and verified suppliers.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/75">
      {email ? (
        <a
          href={`mailto:${email}`}
          className={`inline-flex items-center gap-2 transition-colors hover:text-white ${focusRing}`}
        >
          <Mail className="h-4 w-4 shrink-0 text-[#D7D9DC]/70" aria-hidden />
          {email}
        </a>
      ) : null}
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className={`inline-flex items-center gap-2 transition-colors hover:text-white ${focusRing}`}
        >
          <Phone className="h-4 w-4 shrink-0 text-[#D7D9DC]/70" aria-hidden />
          {phone}
        </a>
      ) : null}
      {address ? (
        <span className="inline-flex items-start gap-2 max-w-xs">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D7D9DC]/70" aria-hidden />
          {address}
        </span>
      ) : null}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 transition-colors hover:text-white ${focusRing}`}
        >
          <Globe className="h-4 w-4 shrink-0 text-[#D7D9DC]/70" aria-hidden />
          {website.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
    </div>
  );
}

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled && s) setSettings(s as SiteSettings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = settings?.companyName?.trim() || 'MITFAST';
  const logoUrl = settings?.logoUrl?.trim() || '/images/logo.png';
  const email = settings?.businessEmail?.trim();
  const phone = settings?.businessPhone?.trim();
  const address = settings?.businessAddress?.trim();
  const website = settings?.website?.trim();

  return (
    <>
      <footer
        className="site-footer site-footer__grid-bg relative z-20 w-full text-white bg-[#111315] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        aria-label="Site footer"
      >
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 py-14 sm:px-8 md:py-20 lg:px-10">
          <FooterCTA />

          <div className="grid grid-cols-1 gap-10 border-b border-white/10 py-10 md:grid-cols-12 md:gap-8 md:py-12 lg:gap-12">
            <div className="md:col-span-5 lg:col-span-5 space-y-5">
              <Link href="/" className={`inline-flex ${focusRing}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="h-9 w-auto brightness-0 invert"
                />
              </Link>
              <p className="max-w-sm text-sm leading-relaxed text-white/75 sm:text-base">
                Marketplace for precision products, fasteners, and CNC parts — verified suppliers,
                inspection-backed orders.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-[#D7D9DC]/80">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>ISO 9001</span>
                <span className="text-white/25" aria-hidden>
                  ·
                </span>
                <span>AS9100D</span>
                <span className="text-white/25" aria-hidden>
                  ·
                </span>
                <span>Inspection-backed orders</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 md:col-span-7 lg:col-span-7">
              <FooterNavColumn title="Products & Orders" links={PRODUCT_LINKS} />
              <FooterNavColumn title="Suppliers" links={SUPPLIER_LINKS} />
              <FooterNavColumn title="Account" links={ACCOUNT_LINKS} />
            </div>
          </div>

          <div className="py-8">
            <FooterContact
              email={email}
              phone={phone}
              address={address}
              website={website}
            />
          </div>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
            <p className="font-mono text-[11px] tracking-wide text-white/50">
              &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
            <div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
              <Link href="/terms" className={`transition-colors hover:text-white ${focusRing}`}>
                Terms
              </Link>
              <Link href="/privacy" className={`transition-colors hover:text-white ${focusRing}`}>
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
