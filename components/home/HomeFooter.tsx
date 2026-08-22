'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, Award, Globe, Cpu, MapPin, Mail, Phone } from 'lucide-react';

export default function HomeFooter() {
  return (
    <footer className="w-full bg-[#f1f3f7] text-[#090e17] border-t border-slate-300/80 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        {/* Top Trust Badges Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 px-8 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#090e17]">ISO 9001:2015</div>
              <div className="text-[11px] text-[#718096]">Certified Quality Gate</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-[#0d9488]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#090e17]">AS9100D Standard</div>
              <div className="text-[11px] text-[#718096]">Aerospace Traceability</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-[#0d9488]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#090e17]">100% CMM Gate</div>
              <div className="text-[11px] text-[#718096]">Dimensional Lab Report</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-[#0d9488]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#090e17]">Global Sourcing</div>
              <div className="text-[11px] text-[#718096]">Direct Factory Network</div>
            </div>
          </div>
        </div>

        {/* 4-Column Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Company Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#090e17] text-white font-bold text-base">
                M
              </div>
              <span className="font-display font-bold text-xl text-[#090e17] tracking-tight">
                MIT<span className="text-[#0d9488]">FAST</span>
              </span>
            </div>

            <p className="text-sm text-[#3f4f68] leading-relaxed max-w-sm">
              Enterprise digital procurement platform for precision engineering components, aerospace fasteners, CNC turned parts, and hydraulic hardware.
            </p>

            <div className="text-xs font-sans text-[#3f4f68] space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#0d9488]" />
                <a href="mailto:procurement@mitfast.com" className="text-[#090e17] font-semibold hover:underline">
                  procurement@mitfast.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Operations: Bangalore · Pune · Stuttgart</span>
              </div>
            </div>
          </div>

          {/* Sourcing & Products Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#090e17] font-sans">
              Catalog & Procurement
            </h4>
            <ul className="space-y-2.5 text-sm text-[#3f4f68]">
              <li>
                <Link href="/products" className="hover:text-[#090e17] transition-colors">
                  Complete Catalog
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-[#090e17] transition-colors">
                  Component Categories
                </Link>
              </li>
              <li>
                <Link href="/enquiry" className="hover:text-[#090e17] transition-colors">
                  Custom Blueprint RFQ
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-[#090e17] transition-colors">
                  RFQ Workspace
                </Link>
              </li>
            </ul>
          </div>

          {/* Supplier Network */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#090e17] font-sans">
              Suppliers
            </h4>
            <ul className="space-y-2.5 text-sm text-[#3f4f68]">
              <li>
                <Link href="/auth/supplier/register" className="hover:text-[#090e17] transition-colors">
                  Supplier Onboarding
                </Link>
              </li>
              <li>
                <Link href="/auth?role=supplier&mode=signin" className="hover:text-[#090e17] transition-colors">
                  Supplier Portal
                </Link>
              </li>
              <li>
                <Link href="/auth/supplier/pending" className="hover:text-[#090e17] transition-colors">
                  Application Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Enterprise Workspaces */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#090e17] font-sans">
              Portals
            </h4>
            <ul className="space-y-2.5 text-sm text-[#3f4f68]">
              <li>
                <Link href="/auth?role=buyer&mode=signin" className="hover:text-[#090e17] transition-colors">
                  Buyer Sign In
                </Link>
              </li>
              <li>
                <Link href="/customer/dashboard" className="hover:text-[#090e17] transition-colors">
                  Buyer Workspace
                </Link>
              </li>
              <li>
                <Link href="/admin/dashboard" className="hover:text-[#090e17] transition-colors">
                  Admin Command Center
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between text-xs text-[#718096] gap-4">
          <div>
            &copy; {new Date().getFullYear()} MITFAST Precision B2B Network. All rights reserved.
          </div>
          <div className="flex gap-6 font-medium text-[#3f4f68]">
            <span className="hover:text-[#090e17] cursor-pointer">Terms of Procurement</span>
            <span className="hover:text-[#090e17] cursor-pointer">Supplier SLA</span>
            <span className="hover:text-[#090e17] cursor-pointer">Quality Verification Gate</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
