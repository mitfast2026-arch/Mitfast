'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, AlertCircle, Save } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import CountrySelect from '@/components/ui/CountrySelect';

export default function SupplierRejectedPage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');

  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadSupplierData() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        router.push('/auth?role=supplier&mode=signin');
        return;
      }

      const { data: sup } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (sup) {
        setSupplier(sup);
        setCompanyName(sup.company_name || '');
        setContactPerson(sup.contact_person || '');
        setPhone(sup.phone || '');
        setAddress(sup.address || '');
        setCountry(sup.country || 'India');
        setWebsite(sup.website || '');
      }
      setLoading(false);
    }

    loadSupplierData();
  }, [router]);

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setResubmitting(true);

    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
          country: country.trim(),
          website: website.trim() || null,
          resubmit: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Resubmission failed');
        setResubmitting(false);
      } else {
        router.push('/auth/supplier/pending');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error while resubmitting application');
      setResubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen saas-canvas-bg flex items-center justify-center py-16 px-4">
        <div className="text-xs font-mono text-portal-muted">Loading application status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="saas-icon-well-lg mx-auto text-portal-danger">
            <XCircle className="w-6 h-6" />
          </div>
          <h1 className="type-page text-xl sm:text-xl">Supplier application requires revision</h1>
          <p className="type-subtitle">
            Review the audit feedback below and update your registration details for re-evaluation.
          </p>
        </div>

        {supplier?.rejection_reason && (
          <div className="p-4 rounded-2xl bg-portal-danger-soft border border-portal-danger/30 space-y-1 text-xs">
            <div className="font-semibold text-portal-danger flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Admin feedback
            </div>
            <div className="text-portal-danger font-mono pl-5">"{supplier.rejection_reason}"</div>
          </div>
        )}

        <div className="saas-panel p-6 space-y-4">
          <form onSubmit={handleResubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="saas-label">Company Legal Entity *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="saas-label">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="saas-input"
                />
              </div>
              <div className="space-y-1">
                <label className="saas-label">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="saas-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="saas-label">Factory / Office Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="saas-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="saas-label">Website URL</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="saas-input"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-2xl bg-portal-danger-soft border border-portal-danger/30 text-xs text-portal-danger flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" disabled={resubmitting} className="saas-btn-primary w-full py-2 gap-2 mt-2">
              <Save className="w-3.5 h-3.5" />
              {resubmitting ? 'Resubmitting...' : 'Save & resubmit application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
