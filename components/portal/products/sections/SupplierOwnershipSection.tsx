'use client';

import React from 'react';
import { Copy, Check, Building2 } from 'lucide-react';
import ProductFormSection, { FormField, FormGrid } from '../ProductFormSection';
import { getCountryOptions } from '@/lib/country-origin';
import { shortId } from '@/app/admin/products/types';
import type {
  ProductFormMode,
  ProductFormProduct,
  ProductFormValues,
  SupplierOption,
} from '../product-form.types';

const COUNTRY_OPTIONS = getCountryOptions();
const OTHER_VALUE = '__other__';

type SupplierOwnershipSectionProps = {
  values: ProductFormValues;
  product?: ProductFormProduct | null;
  suppliers: SupplierOption[];
  mode: ProductFormMode;
  supplierName?: string;
  copied?: boolean;
  onChange: (patch: Partial<ProductFormValues>) => void;
  onCopyId?: () => void;
};

export default function SupplierOwnershipSection({
  values,
  product,
  suppliers,
  mode,
  supplierName,
  copied,
  onChange,
  onCopyId,
}: SupplierOwnershipSectionProps) {
  const isAdmin = mode.includes('admin');
  const isSupplier = mode.includes('supplier');
  const readOnly = isSupplier;

  if (isSupplier && product?.supplier) {
    return (
      <ProductFormSection id="section-supplier" title="Supplier & Ownership" defaultOpen={false}>
        <div className="flex items-start gap-3 p-3 rounded-md bg-portal-inset border border-portal-border">
          <Building2 className="w-4 h-4 text-portal-muted mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-portal-text">{product.supplier.company_name}</div>
            <div className="text-[11px] text-portal-muted mt-0.5">
              {product.supplier.country || 'Location not set'}
            </div>
            <span className="saas-badge-success text-[10px] mt-2 inline-block">Your listing</span>
          </div>
        </div>
      </ProductFormSection>
    );
  }

  if (!isAdmin) return null;

  const displayName =
    supplierName ||
    suppliers.find((s) => s.id === values.supplierId)?.company_name ||
    (values.supplierId ? 'Supplier' : '');

  return (
    <ProductFormSection id="section-supplier" title="Supplier & Ownership" defaultOpen={false}>
      <FormField label="Supplier" optional>
        <select
          disabled={readOnly}
          value={values.supplierId}
          onChange={(e) => onChange({ supplierId: e.target.value })}
          className="saas-input text-xs"
        >
          <option value="">None — Internal Product</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.company_name}</option>
          ))}
        </select>
      </FormField>

      {values.supplierId ? (
        <FormGrid>
          <FormField label="Assigned supplier">
            <input
              type="text"
              readOnly
              value={displayName}
              className="saas-input text-xs bg-portal-inset cursor-default"
            />
          </FormField>
          <FormField label="Supplier ID">
            <div className="flex gap-1">
              <input
                type="text"
                readOnly
                value={shortId(values.supplierId)}
                className="saas-input text-xs font-mono bg-portal-inset flex-1"
              />
              {onCopyId && (
                <button type="button" onClick={onCopyId} className="saas-neu-button px-2 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-portal-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </FormField>
        </FormGrid>
      ) : (
        <div className="text-xs text-portal-muted px-3 py-2 rounded-md bg-portal-inset border border-portal-border">
          Internal product — no supplier assigned. MITFAST owns this listing.
        </div>
      )}

      {values.supplierId && !readOnly && (
        <FormField label="Supplier location">
          <select
            value={values.locationMode}
            onChange={(e) => onChange({ locationMode: e.target.value })}
            className="saas-input text-xs"
          >
            <option value="">Select country…</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.label}>{c.label}</option>
            ))}
            <option value={OTHER_VALUE}>Other (custom)</option>
          </select>
          {values.locationMode === OTHER_VALUE && (
            <input
              type="text"
              value={values.locationOther}
              onChange={(e) => onChange({ locationOther: e.target.value })}
              placeholder="Country or region"
              className="saas-input text-xs mt-2"
            />
          )}
        </FormField>
      )}
    </ProductFormSection>
  );
}
