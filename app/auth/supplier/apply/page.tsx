'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import CountrySelect from '@/components/ui/CountrySelect';

export default function SupplierApplyPage() {
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [plantAddress, setPlantAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        setErrorMsg('This account is a buyer. Use a different email for supplier access.');
        setLoading(false);
        return;
      }

      const nameOk = (profile?.full_name || '').trim().length >= 2;
      const phoneOk = (profile?.phone || '').trim().length >= 7;
      if (!nameOk || !phoneOk) {
        window.location.assign('/auth/complete-profile?role=supplier');
        return;
      }

      setEmail((profile?.email || user.email || '').trim());
      setContactPerson((profile?.full_name || '').trim());
      setPhone((profile?.phone || '').trim());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Could not submit application');
        return;
      }
      window.location.assign('/auth/supplier/pending');
    } catch {
      setErrorMsg('Unexpected error submitting application');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen saas-canvas-bg flex items-center justify-center">
        <p className="type-subtitle">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-4 text-center">
        <Link href="/" className="inline-block">
          <span className="text-xl font-semibold text-[#111315] tracking-tight">MITFAST B2B</span>
        </Link>
        <h1 className="type-page text-2xl">Supplier application</h1>
        <p className="type-subtitle">Admin approval required before account access</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="saas-panel py-8 px-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="saas-label">Business email</label>
              <input type="email" value={email} readOnly className="saas-input" />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Company legal entity *</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input"
                placeholder="e.g. AeroFast Precision Engineering Ltd"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Contact person *</label>
              <input
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="saas-input"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Phone *</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="saas-input"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Plant / facility address *</label>
              <input
                required
                value={plantAddress}
                onChange={(e) => setPlantAddress(e.target.value)}
                className="saas-input"
                placeholder="e.g. Peenya Industrial Area, Bengaluru"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Country *</label>
              <CountrySelect
                required
                value={country}
                onChange={setCountry}
                className="saas-input"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Website (optional)</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="saas-input"
                placeholder="https://"
              />
            </div>

            <button type="submit" disabled={saving} className="saas-btn-primary w-full py-2.5 gap-2">
              <span>{saving ? 'Submitting…' : 'Submit for approval'}</span>
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
