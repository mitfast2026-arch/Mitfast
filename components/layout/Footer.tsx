'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type SiteSettings = {
  companyName?: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  website?: string | null;
};

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success && json.data) {
          setSettings(json.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = settings?.companyName?.trim() || 'MITFAST';
  const email = settings?.businessEmail?.trim();
  const phone = settings?.businessPhone?.trim();
  const address = settings?.businessAddress?.trim();
  const website = settings?.website?.trim();

  const contactParts = [email, phone].filter(Boolean);

  return (
    <footer className="w-full border-t border-[#2A3036] bg-[#1F2429] text-[#9CA3AF] text-xs pt-12 pb-10">
      <div className="container-custom space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-tight">{companyName}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#2A3036] border border-[#374151] rounded text-[#D7D9DC]">
                B2B
              </span>
            </div>
            <p className="leading-relaxed text-[#9CA3AF] text-[11px]">
              Enterprise procurement platform for precision engineering components, fasteners, and CNC parts.
            </p>
            {(contactParts.length > 0 || address || website) && (
              <div className="text-[11px] text-[#6B7280] space-y-1">
                {contactParts.length > 0 && (
                  <div>
                    Contact:{' '}
                    {email ? (
                      <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                        {email}
                      </a>
                    ) : null}
                    {email && phone ? ' · ' : null}
                    {phone ? (
                      <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">
                        {phone}
                      </a>
                    ) : null}
                  </div>
                )}
                {address && <div>{address}</div>}
                {website && (
                  <div>
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      {website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white font-mono text-[11px] uppercase tracking-wider">
              Catalog &amp; Procurement
            </div>
            <ul className="space-y-1.5 text-[11px]">
              <li><Link href="/products" className="hover:text-white transition-colors">Complete Catalog</Link></li>
              <li><Link href="/categories" className="hover:text-white transition-colors">Component Categories</Link></li>
              <li><Link href="/cart" className="hover:text-white transition-colors">RFQ Workspace</Link></li>
              <li><Link href="/enquiry" className="hover:text-white transition-colors">Custom Drawing Inquiry</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white font-mono text-[11px] uppercase tracking-wider">Suppliers</div>
            <ul className="space-y-1.5 text-[11px]">
              <li><Link href="/auth?role=supplier&mode=register" className="hover:text-white transition-colors">Supplier Onboarding</Link></li>
              <li><Link href="/auth?role=supplier&mode=signin" className="hover:text-white transition-colors">Supplier Portal</Link></li>
              <li><Link href="/supplier/dashboard" className="hover:text-white transition-colors">Manufacturing Telemetry</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white font-mono text-[11px] uppercase tracking-wider">Portals</div>
            <ul className="space-y-1.5 text-[11px]">
              <li><Link href="/auth" className="hover:text-white transition-colors">Enterprise Sign In</Link></li>
              <li><Link href="/customer/dashboard" className="hover:text-white transition-colors">Buyer Workspace</Link></li>
              <li><Link href="/admin/dashboard" className="hover:text-white transition-colors">Admin Command Center</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-[#2A3036] flex flex-col sm:flex-row items-center justify-between text-[#6B7280] text-[11px] gap-2 font-mono">
          <div>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
