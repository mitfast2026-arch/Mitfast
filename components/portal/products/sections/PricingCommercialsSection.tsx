'use client';

import React from 'react';
import ProductFormSection, { FormField, FormGrid } from '../ProductFormSection';
import { computeCustomerPrice, computeListPrice } from '@/app/admin/products/types';
import type { ProductFormMode, ProductFormProduct, ProductFormValues } from '../product-form.types';

type PricingCommercialsSectionProps = {
  values: ProductFormValues;
  errors: Record<string, string>;
  product?: ProductFormProduct | null;
  mode: ProductFormMode;
  onChange: (patch: Partial<ProductFormValues>) => void;
};

function statusBadge(status?: string) {
  switch (status) {
    case 'approved':
      return 'saas-badge-success';
    case 'update_pending':
    case 'pending':
      return 'saas-badge-gold';
    case 'rejected':
      return 'saas-badge-danger';
    default:
      return 'saas-badge-neutral';
  }
}

export default function PricingCommercialsSection({
  values,
  errors,
  product,
  mode,
  onChange,
}: PricingCommercialsSectionProps) {
  const isAdmin = mode.includes('admin');
  const isSupplier = mode.includes('supplier');
  const readOnly = mode === 'review-admin';
  const proposed = product?.pendingRequest?.proposed_data as Record<string, number> | undefined;
  const hasPendingUpdate =
    product?.pendingRequest?.status === 'update_pending' && Boolean(proposed);

  const liveSupplierPrice = product?.supplier_price ?? 0;
  const liveSelling = product?.selling_price ?? 0;
  const proposedPrice = proposed?.supplier_price;
  const proposedSuggestedMoq = proposed?.suggested_moq;

  const listPrice = computeListPrice(values.supplierPrice, values.profit);
  const effectiveDiscount = values.discountEnabled ? values.discount : 0;
  const sellingPrice = computeCustomerPrice(listPrice, effectiveDiscount);

  const supplierFieldsDisabled = readOnly || (isAdmin && hasPendingUpdate && !isSupplier);

  return (
    <ProductFormSection id="section-pricing" title="Pricing & Commercials" defaultOpen>
      {product && isAdmin && (
        <div className="rounded-md border border-portal-border bg-portal-inset p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <span className="font-medium text-portal-text">Pricing summary</span>
            <span className={`${statusBadge(product.approval_status)} text-[10px]`}>
              {(product.approval_status || 'unknown').replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
            <div className="text-portal-muted">Live selling price</div>
            <div className="text-portal-text text-right">
              ₹{liveSelling.toLocaleString('en-IN')}
              <span className="text-portal-muted font-sans ml-1">
                (factory ₹{liveSupplierPrice.toLocaleString('en-IN')})
              </span>
            </div>
            {hasPendingUpdate && proposedPrice != null && (
              <>
                <div className="text-portal-muted">Supplier proposed price</div>
                <div className="text-portal-warning text-right font-medium">
                  ₹{Number(proposedPrice).toLocaleString('en-IN')}
                </div>
              </>
            )}
            {hasPendingUpdate && proposedSuggestedMoq != null && (
              <>
                <div className="text-portal-muted">Supplier suggested MOQ</div>
                <div className="text-portal-warning text-right font-medium">
                  {Number(proposedSuggestedMoq).toLocaleString('en-IN')}
                </div>
              </>
            )}
            {(product.suggested_moq != null || values.suggestedMoq > 0) && (
              <>
                <div className="text-portal-muted">Suggested MOQ (supplier)</div>
                <div className="text-portal-text text-right">
                  {(product.suggested_moq ?? values.suggestedMoq).toLocaleString('en-IN')}
                </div>
              </>
            )}
            <div className="text-portal-muted">Catalog MOQ</div>
            <div className="text-portal-text text-right">{(product.moq ?? values.moq).toLocaleString('en-IN')}</div>
            <div className="text-portal-muted">Margin</div>
            <div className="text-portal-text text-right">{product.profit_value ?? values.profit}%</div>
            <div className="text-portal-muted">Discount / unit</div>
            <div className="text-portal-text text-right">
              ₹{(product.discount ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          {product.pendingRequest?.reviewed_at && (
            <p className="text-[10px] text-portal-muted pt-1 border-t border-portal-border">
              Last reviewed {new Date(product.pendingRequest.reviewed_at).toLocaleString('en-IN')}
            </p>
          )}
          {product.pendingRequest?.rejection_reason && (
            <p className="text-[10px] text-portal-warning">{product.pendingRequest.rejection_reason}</p>
          )}
        </div>
      )}

      {isSupplier && (
        <FormGrid>
          <FormField label="Your factory price (₹)" required error={errors.supplierPrice}>
            <input
              type="number"
              min={0}
              step="any"
              disabled={readOnly}
              value={values.supplierPrice}
              onChange={(e) => onChange({ supplierPrice: parseFloat(e.target.value) || 0 })}
              className="saas-input type-metric text-xs"
            />
          </FormField>
          <FormField label="Suggested MOQ" required error={errors.suggestedMoq}>
            <input
              type="number"
              min={1}
              disabled={readOnly}
              value={values.suggestedMoq}
              onChange={(e) => onChange({ suggestedMoq: parseInt(e.target.value, 10) || 1 })}
              className="saas-input type-metric text-xs"
            />
            <p className="text-[10px] text-portal-muted mt-1">
              Admin sets the catalog MOQ shown to buyers.
            </p>
          </FormField>
        </FormGrid>
      )}

      {isAdmin && (
        <>
          <FormGrid>
            <FormField label="Factory / base price (₹)" required error={errors.supplierPrice}>
              <input
                type="number"
                min={0}
                step="any"
                disabled={supplierFieldsDisabled}
                value={values.supplierPrice}
                onChange={(e) => onChange({ supplierPrice: parseFloat(e.target.value) || 0 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField label="Suggested MOQ (from supplier)" optional>
              <input
                type="number"
                min={1}
                disabled
                value={values.suggestedMoq || product?.suggested_moq || ''}
                className="saas-input type-metric text-xs bg-portal-inset cursor-default"
              />
            </FormField>
            <FormField label="Catalog MOQ" required error={errors.moq}>
              <input
                type="number"
                min={1}
                disabled={readOnly}
                value={values.moq}
                onChange={(e) => onChange({ moq: parseInt(e.target.value, 10) || 1 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField label="Margin / profit (%)" required error={errors.profit}>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={values.profit}
                onChange={(e) => onChange({ profit: parseFloat(e.target.value) || 0 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField label="GST rate (%)" optional error={errors.gst}>
              <input
                type="number"
                min={0}
                max={100}
                disabled={readOnly}
                value={values.gst}
                onChange={(e) => onChange({ gst: parseFloat(e.target.value) || 0 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField label="Min order value (₹)" optional>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={values.minValue}
                onChange={(e) => onChange({ minValue: parseFloat(e.target.value) || 0 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
          </FormGrid>

          <label className="flex items-center gap-2 text-xs text-portal-text cursor-pointer">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={values.discountEnabled}
              onChange={(e) =>
                onChange({
                  discountEnabled: e.target.checked,
                  discount: e.target.checked ? values.discount : 0,
                })
              }
              className="rounded border-portal-border"
            />
            Apply unit discount
          </label>

          {values.discountEnabled && (
            <FormField label="Discount (₹ / unit)" optional error={errors.discount}>
              <input
                type="number"
                min={0}
                disabled={readOnly}
                value={values.discount}
                onChange={(e) => onChange({ discount: parseFloat(e.target.value) || 0 })}
                className="saas-input type-metric text-xs"
              />
            </FormField>
          )}

          <label className="flex items-center gap-2 text-xs text-portal-text cursor-pointer">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={values.gstIncluded}
              onChange={(e) => onChange({ gstIncluded: e.target.checked })}
              className="rounded border-portal-border"
            />
            GST included in factory price
          </label>

          <div className="text-xs text-portal-muted bg-portal-panel border border-portal-border rounded-md p-2.5 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span>Factory price</span>
              <span className="text-portal-text">₹{values.supplierPrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>List price (+{values.profit}% margin)</span>
              <span className="text-portal-text">₹{listPrice.toLocaleString('en-IN')}</span>
            </div>
            {values.discountEnabled && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span className="text-portal-text">−₹{effectiveDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-portal-border">
              <span className="text-portal-text">Selling price</span>
              <span className="text-portal-success">₹{sellingPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </>
      )}

      {isSupplier && (
        <p className="text-[11px] text-portal-muted">
          Only your factory price and suggested MOQ are submitted. Admin sets catalog MOQ, margin, and
          selling price.
        </p>
      )}
    </ProductFormSection>
  );
}
