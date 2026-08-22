'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#2A3036] bg-[#1F2429] text-[#9CA3AF] text-xs pt-12 pb-10">
      <div className="container-custom space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-tight">
                MITFAST
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#2A3036] border border-[#374151] rounded text-[#D7D9DC]">
                ENTERPRISE
              </span>
            </div>
            <p className="leading-relaxed text-[#9CA3AF] text-[11px]">
              Enterprise digital supply chain and procurement platform for precision engineering components, aerospace fasteners, and CNC turned parts.
            </p>
            <div className="text-[11px] font-mono text-[#6B7280]">
              Contact: support@mitfast.com
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white font-mono text-[11px] uppercase tracking-wider">Catalog & Procurement</div>
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
          <div>
            &copy; {new Date().getFullYear()} MITFAST Precision B2B Network. All rights reserved.
          </div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
