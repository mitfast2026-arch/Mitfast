'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  ShieldCheck,
  LogOut,
  ArrowRight,
  Archive,
  RefreshCw,
  CheckCircle2,
  Building2,
  FileText,
  Sparkles,
} from 'lucide-react';
import gsap from 'gsap';
import { createBrowserClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { signOutTo } from '@/lib/client/sign-out';

function SupplierPendingContent() {
  const searchParams = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isArchived, setIsArchived] = useState(
    searchParams.get('status') === 'archived'
  );
  const [checking, setChecking] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [contactPerson, setContactPerson] = useState<string | null>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.96, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, []);

  async function checkSupplierStatus() {
    setChecking(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign('/auth?role=supplier&mode=signin');
        return;
      }

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('status, company_name, contact_person')
        .eq('user_id', user.id)
        .maybeSingle();

      if (supplier) {
        setCompanyName(supplier.company_name);
        setContactPerson(supplier.contact_person);
      }

      if (supplier?.status === 'active') {
        window.location.assign('/supplier/dashboard');
        return;
      }
      if (supplier?.status === 'rejected') {
        window.location.assign('/auth/supplier/rejected');
        return;
      }
      if (supplier?.status === 'archived') {
        setIsArchived(true);
      }
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  }

  useEffect(() => {
    checkSupplierStatus();
  }, [searchParams]);

  function handleSignOut() {
    signOutTo('/auth?role=supplier&mode=signin');
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex items-center justify-center py-16 px-4">
      <div
        ref={cardRef}
        className="w-full max-w-lg saas-panel p-8 text-center space-y-6 border border-slate-200/80 rounded-2xl bg-white shadow-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-inner">
          {isArchived ? <Archive className="w-8 h-8" /> : <Clock className="w-8 h-8 animate-pulse" />}
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            {isArchived ? 'Account Archived' : 'Application Under Review'}
          </span>
          <h1 className="type-page text-2xl font-bold text-slate-900">
            {isArchived ? 'Supplier Account Archived' : 'Supplier Application Submitted'}
          </h1>
          <p className="type-subtitle text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {isArchived
              ? 'Your supplier account has been archived by the platform administrator. Access is paused until your profile is reactivated.'
              : 'Thank you for submitting your manufacturing profile. Our procurement team is currently reviewing your compliance credentials.'}
          </p>
        </div>

        {companyName && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-left flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 font-medium">Applied Legal Entity</span>
              <p className="font-semibold text-slate-800">{companyName}</p>
            </div>
            {contactPerson && (
              <div className="text-right space-y-0.5">
                <span className="text-[11px] text-slate-500 font-medium">Primary Contact</span>
                <p className="font-semibold text-slate-800">{contactPerson}</p>
              </div>
            )}
          </div>
        )}

        {!isArchived && (
          <div className="saas-inset-surface p-4 text-left space-y-3 text-xs bg-slate-50/70 border border-slate-200/80 rounded-xl">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Admin Verification Workflow</span>
            </div>
            <ul className="space-y-2 text-slate-600 text-[12px]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>GSTIN & Corporate entity validation in progress</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Manufacturing facility & CNC machinery tolerance appraisal</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>ISO 9001 / AS9100 quality compliance verification</span>
              </li>
            </ul>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={checkSupplierStatus}
            disabled={checking}
            className="saas-btn-primary w-full sm:w-auto py-2.5 px-5 gap-2 text-xs font-medium justify-center bg-slate-900 hover:bg-black text-white rounded-xl shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status…' : 'Check Approval Status'}</span>
          </button>

          <Link
            href="/"
            className="saas-btn-secondary w-full sm:w-auto py-2.5 px-5 gap-1.5 text-xs font-medium justify-center rounded-xl border border-slate-200"
          >
            <span>Public Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full sm:w-auto py-2.5 px-4 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen saas-canvas-bg flex items-center justify-center text-xs font-mono text-slate-500">
          Loading status…
        </div>
      }
    >
      <SupplierPendingContent />
    </Suspense>
  );
}
