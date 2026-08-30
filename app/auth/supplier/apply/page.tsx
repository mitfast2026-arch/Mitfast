'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { createBrowserClient } from '@/lib/supabase/client';
import CountrySelect from '@/components/ui/CountrySelect';

export default function SupplierApplyPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [plantAddress, setPlantAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.assign('/auth?role=supplier&mode=signin');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, email, role')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: supplier } = await supabase
          .from('suppliers')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (supplier?.status === 'active') {
          window.location.assign('/supplier/dashboard');
          return;
        }
        if (supplier?.status === 'pending') {
          window.location.assign('/auth/supplier/pending');
          return;
        }
        if (supplier?.status === 'rejected') {
          window.location.assign('/auth/supplier/rejected');
          return;
        }

        if (profile?.role === 'customer') {
          setErrorMsg('This account is already registered as a buyer. Please use a separate business email for supplier registration.');
          setLoading(false);
          return;
        }

        const authProvider = user.app_metadata?.provider || (user.identities && user.identities[0]?.provider);
        setIsGoogleAuth(authProvider === 'google');

        const resolvedEmail = (profile?.email || user.email || '').trim();
        const metaName =
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          '';
        const resolvedName = (profile?.full_name || metaName || '').trim();
        const resolvedPhone = (profile?.phone || '').trim();

        setEmail(resolvedEmail);
        setContactPerson(resolvedName);
        setPhone(resolvedPhone);
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize supplier application');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // GSAP Entrance Motion
  useEffect(() => {
    if (!loading && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErrorMsg('');
    setSaving(true);

    try {
      const res = await fetch('/api/auth/register-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          address: plantAddress.trim(),
          country: country.trim(),
          website: website.trim(),
          termsAccepted: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Could not submit supplier application');
        setSaving(false);
        return;
      }

      window.location.assign('/auth/supplier/pending');
    } catch {
      setErrorMsg('Unexpected error submitting application. Please try again.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen saas-canvas-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="type-subtitle text-xs font-mono">Preparing supplier onboarding…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div ref={containerRef} className="sm:mx-auto sm:w-full sm:max-w-lg space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Store</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-xl font-bold text-[#111315] tracking-tight">MITFAST B2B</span>
          </Link>
          <div className="w-16" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="type-page text-2xl sm:text-3xl font-semibold">Supplier Onboarding</h1>
          <p className="type-subtitle text-sm">
            Complete your manufacturing profile for admin review and enterprise catalog access.
          </p>
        </div>

        <div className="saas-panel py-6 sm:py-8 px-4 sm:px-8 space-y-5 sm:space-y-6 border border-slate-200/80 shadow-sm rounded-2xl bg-white">
          {isGoogleAuth && (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Email Verified via Google.</strong> Enter your corporate facility details below to submit for Admin approval.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="saas-label text-xs font-medium text-slate-700">Verified Business Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="saas-input bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200"
              />
              <p className="text-[11px] text-slate-500">Locked to your authenticated login identity</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="saas-label text-xs font-medium text-slate-700">Company Legal Entity *</label>
                <div className="relative">
                  <input
                    required
                    minLength={2}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="saas-input"
                    placeholder="e.g. AeroFast Precision Ltd"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="saas-label text-xs font-medium text-slate-700">Contact Person *</label>
                <input
                  required
                  minLength={2}
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="saas-input"
                  placeholder="Full Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="saas-label text-xs font-medium text-slate-700">Direct Phone / Mobile *</label>
                <input
                  required
                  type="tel"
                  minLength={7}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="saas-input"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <label className="saas-label text-xs font-medium text-slate-700">Country *</label>
                <CountrySelect
                  required
                  value={country}
                  onChange={setCountry}
                  className="saas-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="saas-label text-xs font-medium text-slate-700">Plant / Facility Address *</label>
              <textarea
                required
                rows={2}
                value={plantAddress}
                onChange={(e) => setPlantAddress(e.target.value)}
                className="saas-input resize-none py-2"
                placeholder="e.g. Plot 42, Peenya Industrial Area Phase II, Bengaluru, Karnataka"
              />
            </div>

            <div className="space-y-1.5">
              <label className="saas-label text-xs font-medium text-slate-700">Website / Portfolio (optional)</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="saas-input"
                placeholder="https://example-manufacturing.com"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="saas-btn-primary w-full py-3 gap-2 font-medium justify-center transition-all bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm hover:shadow"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting for Admin Approval…</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application for Admin Approval</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Direct ISO & Commercial Verification
            </span>
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Return to Catalog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
