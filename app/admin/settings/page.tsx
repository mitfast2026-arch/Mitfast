'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Check, AlertCircle, DollarSign, ShieldCheck, RefreshCw } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [companyName, setCompanyName] = useState('MITFAST Precision B2B');
  const [minimumRfqValue, setMinimumRfqValue] = useState<number>(500000);
  const [defaultGstRate, setDefaultGstRate] = useState<number>(18);
  const [currency, setCurrency] = useState<string>('INR');
  const [maxProductImages, setMaxProductImages] = useState<number>(8);
  const [supplierApprovalRequired, setSupplierApprovalRequired] = useState(true);
  const [productApprovalRequired, setProductApprovalRequired] = useState(true);
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [productsBannerUrl, setProductsBannerUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        const s = json.data;
        setSettings(s);
        setCompanyName(s.companyName || 'MITFAST Precision B2B');
        setMinimumRfqValue(s.minimumRfqValue ?? 500000);
        setDefaultGstRate(s.defaultGstRate ?? 18);
        setCurrency(s.currency || 'INR');
        setMaxProductImages(s.maxProductImages ?? 8);
        setSupplierApprovalRequired(s.supplierApprovalRequired ?? true);
        setProductApprovalRequired(s.productApprovalRequired ?? true);
        setBusinessEmail(s.businessEmail || '');
        setBusinessPhone(s.businessPhone || '');
        setBusinessAddress(s.businessAddress || '');
        setWebsite(s.website || '');
        setLogoUrl(s.logoUrl || '');
        setProductsBannerUrl(s.productsBannerUrl || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
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
          minimumRfqValue,
          defaultGstRate,
          currency: currency.trim(),
          maxProductImages,
          supplierApprovalRequired,
          productApprovalRequired,
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
        setErrorMsg(json.error?.message || 'Failed to update settings.');
      } else {
        setSuccessMsg('Settings saved successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings.');
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

      const res = await fetch('/api/settings/assets', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || `Failed to upload ${kind}`);
        return;
      }

      const url = json.data?.url || '';
      if (kind === 'logo') setLogoUrl(url);
      else setProductsBannerUrl(url);
      setSuccessMsg(`${kind === 'logo' ? 'Logo' : 'Banner'} uploaded successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (kind === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Settings
          </h1>
          <p className="type-subtitle">
            Configure platform parameters, RFQ thresholds, default taxation rates, and moderation rules.
          </p>
        </div>

        <button 
          onClick={loadSettings}
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Config</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] text-xs text-[#15803D] flex items-center gap-2.5 font-medium">
          <Check className="w-4 h-4 shrink-0 text-[#15803D]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] text-xs text-[#B91C1C] flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#B91C1C]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="saas-panel p-6 sm:p-8 space-y-6">
        {/* General & Commercial Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <DollarSign className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">
              Commercial & currency parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="saas-label">Platform Name</label>
              <input 
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Currency Code</label>
              <input 
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="saas-input type-id uppercase text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Minimum RFQ Value (₹)</label>
              <input 
                type="number"
                required
                step={10000}
                value={minimumRfqValue}
                onChange={(e) => setMinimumRfqValue(parseFloat(e.target.value) || 0)}
                className="saas-input type-metric text-[#111315] text-xs"
              />
              <div className="text-[11px] text-[#6B7280]">
                RFQ workspace subtotals below this amount will block submission.
              </div>
            </div>

            <div className="space-y-1">
              <label className="saas-label">Default GST Rate (%)</label>
              <input 
                type="number"
                required
                value={defaultGstRate}
                onChange={(e) => setDefaultGstRate(parseFloat(e.target.value) || 0)}
                className="saas-input type-metric text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Max product images</label>
              <input 
                type="number"
                required
                min={1}
                max={20}
                value={maxProductImages}
                onChange={(e) => setMaxProductImages(parseInt(e.target.value) || 8)}
                className="saas-input type-metric text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Business email</label>
              <input 
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Business phone</label>
              <input 
                type="text"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="saas-label">Business address</label>
              <input 
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="saas-label">Website</label>
              <input 
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="saas-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Brand assets */}
        <div className="space-y-4 pt-4 border-t border-[#E2E4E8]">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <Settings className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">Brand assets</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="saas-label">Logo</label>
              {logoUrl ? (
                <div className="rounded-xl border border-[#E2E4E8] p-3 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Site logo" className="max-h-16 object-contain" />
                </div>
              ) : (
                <p className="text-xs text-[#6B7280]">No logo uploaded</p>
              )}
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Logo URL"
                className="saas-input text-xs"
              />
              <input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAssetUpload('logo', file);
                }}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="saas-label">Products catalog banner</label>
              {productsBannerUrl ? (
                <div className="rounded-xl border border-[#E2E4E8] p-3 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={productsBannerUrl} alt="Products banner" className="max-h-24 w-full object-cover rounded-lg" />
                </div>
              ) : (
                <p className="text-xs text-[#6B7280]">No banner uploaded</p>
              )}
              <input
                type="url"
                value={productsBannerUrl}
                onChange={(e) => setProductsBannerUrl(e.target.value)}
                placeholder="Banner URL"
                className="saas-input text-xs"
              />
              <input
                type="file"
                accept="image/*"
                disabled={uploadingBanner}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAssetUpload('banner', file);
                }}
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Approval Governance */}
        <div className="space-y-4 pt-4 border-t border-[#E2E4E8]">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <h3 className="type-section">
              Quality & governance rules
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F7F8] cursor-pointer hover:bg-[#ECEEF0] transition-colors">
              <input 
                type="checkbox"
                checked={supplierApprovalRequired}
                onChange={(e) => setSupplierApprovalRequired(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#111315]">Require Verification for New Suppliers</div>
                <div className="text-[#6B7280]">New supplier accounts remain pending until approved in the Approval Center.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F7F8] cursor-pointer hover:bg-[#ECEEF0] transition-colors">
              <input 
                type="checkbox"
                checked={productApprovalRequired}
                onChange={(e) => setProductApprovalRequired(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#111315]">Require Verification for Product Updates</div>
                <div className="text-[#6B7280]">Supplier price and spec updates must be approved before taking effect on the public catalog.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Auth / messaging — not wired */}
        <div className="space-y-4 pt-4 border-t border-[#E2E4E8]">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <Settings className="w-4 h-4 text-[#6B7280]" />
            <h3 className="type-section">
              Auth &amp; messaging
            </h3>
          </div>

          <div className="space-y-3 opacity-70">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F7F8] cursor-not-allowed">
              <input
                type="checkbox"
                disabled
                checked={false}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#111315]">Enable OTP login</div>
                <div className="text-[#6B7280]">Not wired in this environment</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F7F8] cursor-not-allowed">
              <input
                type="checkbox"
                disabled
                checked={false}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#111315]">Outbound transactional email</div>
                <div className="text-[#6B7280]">Not wired in this environment</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F7F7F8] cursor-not-allowed">
              <input
                type="checkbox"
                disabled
                checked={settings?.googleLoginEnabled ?? true}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#111315]">Google login flag</div>
                <div className="text-[#6B7280]">Not wired in this environment — value is stored but does not control login flows here</div>
              </div>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E2E4E8] flex justify-end">
          <button 
            type="submit"
            disabled={saving}
            className="saas-btn-primary py-2 px-5 text-xs flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
