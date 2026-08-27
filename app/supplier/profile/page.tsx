'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Save, 
  Check, 
  AlertCircle, 
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CountrySelect from '@/components/ui/CountrySelect';

export default function SupplierProfilePage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [website, setWebsite] = useState('');

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/supplier/profile');
      const json = await res.json();
      if (json.success && json.data.supplier) {
        const s = json.data.supplier;
        setSupplier(s);
        setCompanyName(s.company_name || '');
        setContactPerson(s.contact_person || '');
        setPhone(s.phone || '');
        setAddress(s.address || '');
        setCountry(s.country || 'India');
        setWebsite(s.website || '');
      } else if (res.status === 401) {
        router.push('/auth?role=supplier&mode=signin');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSaveProfile(e: React.FormEvent, isResubmit = false) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          contactPerson,
          phone,
          address: address || null,
          country,
          website: website || null,
          resubmit: isResubmit,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to update supplier profile.');
      } else {
        setSupplier(json.data.supplier);
        setSuccessMsg(isResubmit ? 'Profile updated and resubmitted for admin review.' : 'Profile updated successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-portal-muted text-xs">
        Loading supplier profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Company Profile & Credentials
          </h1>
          <p className="type-subtitle">
            Manage your registered manufacturing facility credentials and primary contact details.
          </p>
        </div>

        <button 
          onClick={loadProfile}
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Rejection Resubmission Banner if Applicable */}
      {supplier?.status === 'rejected' && (
        <div className="p-5 rounded-2xl bg-portal-danger-soft border border-portal-danger/30 text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm text-portal-danger">
            <AlertCircle className="w-5 h-5 text-portal-danger shrink-0" />
            <span>Registration Revision Required</span>
          </div>
          <p className="text-xs text-portal-danger leading-relaxed">
            Admin Feedback: <b className="font-medium text-rose-950">{supplier.rejection_reason || 'Incomplete compliance credentials.'}</b>
          </p>
          <p className="text-xs text-portal-danger">
            Please update the required information below and click "Save & Resubmit for Approval" to notify the operations team.
          </p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2.5 font-medium">
          <Check className="w-4 h-4 shrink-0 text-portal-success" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-portal-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={(e) => handleSaveProfile(e, false)} className="saas-panel p-6 sm:p-8 space-y-6">
        {/* Verification Status Overview */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-portal-inset border border-portal-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-portal-inset text-portal-text flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-portal-text">
                Account Status: <span className="uppercase text-portal-text">{supplier?.status}</span>
              </div>
              <div className="text-[11px] text-portal-muted">
                Registered on {new Date(supplier?.created_at).toLocaleDateString()} • Partner ID: <span className="type-id">{supplier?.id?.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <span className={
            supplier?.status === 'active' 
              ? 'saas-badge-success' 
              : supplier?.status === 'pending' 
              ? 'saas-badge-gold' 
              : 'saas-badge-danger'
          }>
            {supplier?.status?.toUpperCase()}
          </span>
        </div>

        {/* Company Fields */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Building2 className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">
              Facility Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="saas-label">Company Legal Name *</label>
              <input 
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Contact Person *</label>
              <input 
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Primary Business Email</label>
              <input 
                type="email"
                disabled
                value={supplier?.email || ''}
                className="saas-input text-xs bg-portal-inset text-portal-muted cursor-not-allowed"
                title="Account email cannot be modified directly"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Phone / WhatsApp *</label>
              <input 
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Country *</label>
              <CountrySelect
                required
                value={country}
                onChange={setCountry}
              />
              <p className="text-[10px] text-portal-muted mt-1">
                Used as the origin flag on your product cards.
              </p>
            </div>

            <div className="space-y-1">
              <label className="saas-label">Company Website</label>
              <input 
                type="text"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="saas-input text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="saas-label">Factory / Office Address</label>
            <textarea 
              rows={3}
              placeholder="Plot/Factory No, Industrial Estate, City, State, PIN"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="saas-input text-xs resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-portal-border flex flex-wrap justify-end gap-3">
          {supplier?.status === 'rejected' ? (
            <button 
              type="button"
              disabled={saving}
              onClick={(e) => handleSaveProfile(e, true)}
              className="saas-btn-gold text-xs py-2 px-5 flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Submitting...' : 'Save & Resubmit for Approval'}</span>
            </button>
          ) : (
            <button 
              type="submit"
              disabled={saving}
              className="saas-btn-primary text-xs py-2 px-5 flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
