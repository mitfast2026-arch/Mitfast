'use client';

import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Archive,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import CountrySelect from '@/components/ui/CountrySelect';
import { signOutTo } from '@/lib/client/sign-out';

interface SupplierApprovalGateProps {
  supplier: {
    id: string;
    company_name: string;
    contact_person: string;
    email: string;
    phone: string;
    address?: string | null;
    country: string;
    website?: string | null;
    status: 'pending' | 'rejected' | 'archived' | 'active';
    rejection_reason?: string | null;
    created_at: string;
  };
  onSupplierUpdated?: () => void;
}

export default function SupplierApprovalGate({
  supplier,
  onSupplierUpdated,
}: SupplierApprovalGateProps) {
  // Resubmission form state
  const [companyName, setCompanyName] = useState(supplier.company_name || '');
  const [contactPerson, setContactPerson] = useState(supplier.contact_person || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [address, setAddress] = useState(supplier.address || '');
  const [country, setCountry] = useState(supplier.country || 'India');
  const [website, setWebsite] = useState(supplier.website || '');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  function handleSignOut() {
    signOutTo('/auth?role=supplier&mode=signin');
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/resubmit-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          email: supplier.email,
          companyName,
          contactPerson,
          phone,
          address,
          country,
          website: website || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to resubmit application');
      } else {
        setSuccessMsg('Application resubmitted successfully! Status reset to Pending Approval.');
        if (onSupplierUpdated) onSupplierUpdated();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error during resubmission');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen saas-canvas-bg text-portal-text flex flex-col justify-between p-6 sm:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8 my-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-portal-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-portal-hero text-portal-hero-text flex items-center justify-center font-bold text-sm font-mono shadow-xs">
              M
            </div>
            <div>
              <div className="text-xs font-bold font-mono tracking-tight text-portal-text">
                MITFAST SUPPLIER PORTAL
              </div>
              <div className="text-[11px] font-mono text-portal-muted">
                Manufacturing Partner Verification
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="text-xs font-mono text-portal-danger hover:bg-portal-danger-soft px-3 py-1.5 rounded border border-portal-danger/30 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* STATE 1: PENDING APPROVAL */}
        {supplier.status === 'pending' && (
          <div className="saas-panel p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded bg-portal-warning-soft text-portal-warning flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase font-bold text-portal-warning tracking-wider">
                  Status: Pending Approval
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-portal-text">
                  Partner Verification in Progress
                </h1>
                <p className="text-xs sm:text-sm text-portal-muted leading-relaxed">
                  Your supplier organization registration is currently under review by the MITFAST admin and engineering procurement team.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-portal-inset border border-portal-border space-y-2 text-xs font-mono">
              <div className="text-[11px] font-bold text-portal-text uppercase tracking-wider mb-2">
                Registered Application Record
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-portal-text">
                <div><span className="text-portal-muted">Company:</span> {supplier.company_name}</div>
                <div><span className="text-portal-muted">Contact:</span> {supplier.contact_person}</div>
                <div><span className="text-portal-muted">Business Email:</span> {supplier.email}</div>
                <div><span className="text-portal-muted">Phone:</span> {supplier.phone}</div>
                <div><span className="text-portal-muted">Country:</span> {supplier.country}</div>
                <div><span className="text-portal-muted">Website:</span> {supplier.website || 'Not specified'}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-portal-success-soft border border-portal-success/30 flex items-start gap-2.5 text-xs text-portal-success">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed font-sans">
                Verification standard turnaround is 24 to 48 business hours. Once verified, product upload, pricing matrix configuration, and aggregate demand telemetry will automatically activate.
              </div>
            </div>
          </div>
        )}

        {/* STATE 2: REJECTED WITH MANDATORY RESUBMISSION FORM */}
        {supplier.status === 'rejected' && (
          <div className="saas-panel p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded bg-portal-danger-soft text-portal-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase font-bold text-portal-danger tracking-wider">
                  Status: Action Required (Application Rejected)
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-portal-text">
                  Application Requires Additional Information
                </h1>
                <p className="text-xs sm:text-sm text-portal-muted">
                  The administrator has reviewed your submission and requested adjustments before activating your supplier portal.
                </p>
              </div>
            </div>

            {/* Mandatory Reason Display */}
            <div className="p-4 rounded-xl bg-portal-danger-soft border border-portal-danger/30 space-y-1">
              <div className="text-[10px] font-mono uppercase font-bold text-portal-danger">
                Administrator Rejection Reason:
              </div>
              <p className="text-xs font-mono text-portal-danger font-semibold">
                "{supplier.rejection_reason || 'Please provide updated facility address and contact information.'}"
              </p>
            </div>

            {successMsg && (
              <div className="p-3 rounded bg-portal-success-soft border border-portal-success/30 text-xs text-portal-success flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded bg-portal-danger-soft border border-portal-danger/30 text-xs text-portal-danger flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Inline Resubmit Form */}
            <form onSubmit={handleResubmit} className="space-y-4 pt-2 border-t border-portal-border">
              <div className="text-xs font-mono font-bold text-portal-text uppercase tracking-wider">
                Update & Resubmit Supplier Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Phone / Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="saas-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Country *</label>
                  <CountrySelect
                    required
                    value={country}
                    onChange={setCountry}
                    className="saas-input"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Manufacturing Plant / Office Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Plot 10, Industrial Estate, Pune, Maharashtra"
                    className="saas-input"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-mono text-portal-muted">Website / Catalog URL</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.example.com"
                    className="saas-input"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="saas-btn-primary gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Resubmitting...' : 'Resubmit Application for Approval'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STATE 3: ARCHIVED */}
        {supplier.status === 'archived' && (
          <div className="saas-panel p-8 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded bg-portal-inset text-portal-muted flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase font-bold text-portal-muted tracking-wider">
                  Account Archived
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-portal-text">
                  Partner Account Inactive
                </h1>
                <p className="text-xs text-portal-muted">
                  This supplier account has been archived. All active catalog products have been temporarily delisted.
                </p>
              </div>
            </div>

            <p className="text-xs text-portal-muted pt-2 border-t border-portal-border">
              To restore portal access and reactivate published components, please contact your MITFAST vendor coordinator.
            </p>
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] font-mono text-portal-muted">
        MITFAST INDUSTRIAL B2B PLATFORM &bull; SUPPLIER ACCREDITATION ENGINE
      </footer>
    </div>
  );
}
