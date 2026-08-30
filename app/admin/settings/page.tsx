'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  ShoppingCart,
  Building2,
  ImageIcon,
  Loader2,
} from 'lucide-react';

import AdminPageHeader from '@/components/admin/AdminPageHeader';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
  setPortalCache,
} from '@/lib/client/portal-data-cache';
import { invalidateSettings } from '@/lib/client/settings-cache';

type SettingsData = {
  companyName: string;
  minimumRfqValue: number;
  currency: string;
  maxProductImages: number;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  website: string | null;
  logoUrl: string | null;
  productsBannerUrl: string | null;
};

export default function AdminSettingsPage() {
  const cached = peekPortalCache<SettingsData>('/api/settings');
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [companyName, setCompanyName] = useState(cached?.data.companyName || 'MITFAST');
  const [minimumRfqValue, setMinimumRfqValue] = useState<number | ''>(cached?.data.minimumRfqValue ?? 500000);
  const [currency, setCurrency] = useState(cached?.data.currency || 'INR');
  const [maxProductImages, setMaxProductImages] = useState<number | ''>(cached?.data.maxProductImages ?? 8);
  const [businessEmail, setBusinessEmail] = useState(cached?.data.businessEmail || '');
  const [businessPhone, setBusinessPhone] = useState(cached?.data.businessPhone || '');
  const [businessAddress, setBusinessAddress] = useState(cached?.data.businessAddress || '');
  const [website, setWebsite] = useState(cached?.data.website || '');
  const [logoUrl, setLogoUrl] = useState(cached?.data.logoUrl || '');
  const [productsBannerUrl, setProductsBannerUrl] = useState(cached?.data.productsBannerUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  function applySettings(s: SettingsData) {
    setCompanyName(s.companyName || 'MITFAST');
    setMinimumRfqValue(s.minimumRfqValue ?? 500000);
    setCurrency(s.currency || 'INR');
    setMaxProductImages(s.maxProductImages ?? 8);
    setBusinessEmail(s.businessEmail || '');
    setBusinessPhone(s.businessPhone || '');
    setBusinessAddress(s.businessAddress || '');
    setWebsite(s.website || '');
    setLogoUrl(s.logoUrl || '');
    setProductsBannerUrl(s.productsBannerUrl || '');
  }

  async function loadSettings() {
    const existing = peekPortalCache<SettingsData>('/api/settings');
    if (existing) {
      applySettings(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      const result = await cachedApiGet<SettingsData>('/api/settings', {
        force: !existing,
      });
      if (result.ok && result.data) {
        applySettings(result.data);
        markPortalContentReady('/admin/settings');
      } else if (!result.ok) {
        setErrorMsg(result.message || 'Failed to load settings.');
      }
    } catch {
      setErrorMsg('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          minimumRfqValue: minimumRfqValue === '' ? 0 : Number(minimumRfqValue),
          currency: currency.trim().toUpperCase(),
          maxProductImages: maxProductImages === '' ? 8 : Number(maxProductImages),
          businessEmail: businessEmail.trim() || null,
          businessPhone: businessPhone.trim() || null,
          businessAddress: businessAddress.trim() || null,
          website: website.trim() || null,
          logoUrl: logoUrl.trim() || null,
          productsBannerUrl: productsBannerUrl.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to save settings.');
      } else {
        if (json.data) {
          applySettings(json.data);
          setPortalCache('/api/settings', json.data);
        }
        invalidateSettings();
        setSuccessMsg('Settings saved.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch {
      setErrorMsg('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssetUpload(kind: 'logo' | 'banner', file: File) {
    setErrorMsg('');
    if (kind === 'logo') setUploadingLogo(true);
    else setUploadingBanner(true);

    try {
      const formData = new FormData();
      formData.set('kind', kind);
      formData.set('file', file);

      const res = await fetch('/api/settings/assets', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || `Failed to upload ${kind}.`);
        return;
      }

      const url = json.data?.url || '';
      if (kind === 'logo') setLogoUrl(url);
      else setProductsBannerUrl(url);
      setSuccessMsg(`${kind === 'logo' ? 'Logo' : 'Catalog banner'} uploaded. Save if you edited other fields.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Upload failed.');
    } finally {
      if (kind === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-portal-muted">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-xs">Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <AdminPageHeader
        title="Settings"
        description="Platform rules and storefront details used by RFQs, the product catalog, and the public site."
        actions={
          <button type="button" onClick={loadSettings} className="saas-btn-secondary gap-2">
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        }
      />

      {successMsg && (
        <div className="p-3 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-6">
        {/* RFQ & commerce — enforced in cart + RFQ submission */}
        <section className="saas-panel p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <ShoppingCart className="w-4 h-4 text-portal-text" />
            <h2 className="type-section text-sm">RFQ &amp; commerce</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="saas-label">Minimum RFQ value (₹)</label>
              <input
                type="number"
                required
                min={0}
                step={1000}
                placeholder="0"
                value={minimumRfqValue}
                onChange={(e) => setMinimumRfqValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="saas-input type-metric text-xs"
              />
              <p className="text-[11px] text-portal-muted mt-1">
                Cart and RFQ checkout block below this subtotal.
              </p>
            </div>

            <div>
              <label className="saas-label">Currency code</label>
              <input
                type="text"
                required
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="saas-input type-id uppercase text-xs"
              />
              <p className="text-[11px] text-portal-muted mt-1">Used on RFQ records (e.g. INR).</p>
            </div>

            <div>
              <label className="saas-label">Max images per product</label>
              <input
                type="number"
                required
                min={1}
                max={20}
                placeholder="8"
                value={maxProductImages}
                onChange={(e) => setMaxProductImages(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="saas-input type-metric text-xs"
              />
              <p className="text-[11px] text-portal-muted mt-1">Enforced on product create and edit.</p>
            </div>
          </div>
        </section>

        {/* Business contact — shown in site footer */}
        <section className="saas-panel p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Building2 className="w-4 h-4 text-portal-text" />
            <h2 className="type-section text-sm">Business contact</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="saas-label">Company name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input text-xs"
              />
              <p className="text-[11px] text-portal-muted mt-1">Shown in the site footer and navigation.</p>
            </div>

            <div>
              <label className="saas-label">Business email</label>
              <input
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="sales@company.com"
                className="saas-input text-xs"
              />
            </div>

            <div>
              <label className="saas-label">Business phone</label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+91 …"
                className="saas-input text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="saas-label">Business address</label>
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="saas-label">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://mitfast.com"
                className="saas-input text-xs"
              />
            </div>
          </div>
        </section>

        {/* Storefront assets */}
        <section className="saas-panel p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <ImageIcon className="w-4 h-4 text-portal-text" />
            <h2 className="type-section text-sm">Storefront assets</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="saas-label">Site logo</label>
              <p className="text-[11px] text-portal-muted">Replaces the default logo in the top navigation.</p>
              {logoUrl ? (
                <div className="rounded-xl border border-portal-border p-3 bg-portal-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Site logo" className="max-h-12 object-contain" />
                </div>
              ) : (
                <p className="text-xs text-portal-muted">Using default logo until one is uploaded.</p>
              )}
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                className="saas-input text-xs"
              />
              <label className="saas-btn-secondary text-xs py-2 px-3 inline-flex items-center gap-2 cursor-pointer">
                {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLogo}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAssetUpload('logo', file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="saas-label">Products catalog banner</label>
              <p className="text-[11px] text-portal-muted">Hero image on the public /products page.</p>
              {productsBannerUrl ? (
                <div className="rounded-xl border border-portal-border p-3 bg-portal-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productsBannerUrl}
                    alt="Products banner"
                    className="max-h-20 w-full object-cover rounded-lg"
                  />
                </div>
              ) : (
                <p className="text-xs text-portal-muted">No banner set — catalog uses the default hero.</p>
              )}
              <input
                type="url"
                value={productsBannerUrl}
                onChange={(e) => setProductsBannerUrl(e.target.value)}
                placeholder="https://…"
                className="saas-input text-xs"
              />
              <label className="saas-btn-secondary text-xs py-2 px-3 inline-flex items-center gap-2 cursor-pointer">
                {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {uploadingBanner ? 'Uploading…' : 'Upload banner'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingBanner}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAssetUpload('banner', file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="saas-btn-primary py-2 px-5 text-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
