'use client';

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { getCountryOptions, matchCountryLabel } from '@/lib/country-origin';
import { shortId } from './types';

const COUNTRY_OPTIONS = getCountryOptions();
const OTHER_VALUE = '__other__';

type ProductSupplierSectionProps = {
  supplierId: string;
  supplierName: string;
  locationMode: string;
  locationOther: string;
  suppliers: { id: string; company_name: string; country?: string }[];
  copied: boolean;
  onSupplierChange: (id: string) => void;
  onLocationModeChange: (mode: string) => void;
  onLocationOtherChange: (value: string) => void;
  onCopyId: () => void;
};

export default function ProductSupplierSection({
  supplierId,
  supplierName,
  locationMode,
  locationOther,
  suppliers,
  copied,
  onSupplierChange,
  onLocationModeChange,
  onLocationOtherChange,
  onCopyId,
}: ProductSupplierSectionProps) {
  return (
    <section id="panel-supplier" className="space-y-4 scroll-mt-4">
      <h4 className="type-section text-sm border-b border-portal-border pb-2">Supplier</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="saas-label">Supplier Name</label>
          <input
            type="text"
            readOnly
            value={supplierName || '—'}
            className="saas-input text-xs bg-portal-inset cursor-default"
          />
        </div>
        <div>
          <label className="saas-label">Supplier ID</label>
          <div className="flex gap-1">
            <input
              type="text"
              readOnly
              value={supplierId ? shortId(supplierId) : '—'}
              className="saas-input text-xs font-mono bg-portal-inset cursor-default flex-1"
            />
            {supplierId && (
              <button
                type="button"
                onClick={onCopyId}
                className="saas-neu-button px-2 shrink-0"
                title="Copy full ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-portal-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="saas-label">Assign Supplier *</label>
        <select
          required
          value={supplierId}
          onChange={(e) => onSupplierChange(e.target.value)}
          className="saas-input text-xs"
        >
          <option value="">Select active supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.company_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="saas-label">Location</label>
        <select
          value={locationMode}
          onChange={(e) => onLocationModeChange(e.target.value)}
          className="saas-input text-xs"
        >
          <option value="">Select country…</option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.label}>{c.label}</option>
          ))}
          <option value={OTHER_VALUE}>Other (custom)</option>
        </select>
        {locationMode === OTHER_VALUE && (
          <input
            type="text"
            value={locationOther}
            onChange={(e) => onLocationOtherChange(e.target.value)}
            placeholder="Enter country or region"
            className="saas-input text-xs mt-2"
          />
        )}
      </div>
    </section>
  );
}

/** Resolve location dropdown state from supplier country string. */
export function resolveLocationState(country: string | null | undefined): {
  mode: string;
  other: string;
} {
  if (!country?.trim()) return { mode: '', other: '' };
  const matched = matchCountryLabel(country);
  if (matched) return { mode: matched, other: '' };
  return { mode: OTHER_VALUE, other: country.trim() };
}

/** Resolve country string to save from dropdown state. */
export function resolveLocationCountry(mode: string, other: string): string {
  if (mode === OTHER_VALUE) return other.trim();
  return mode.trim();
}
