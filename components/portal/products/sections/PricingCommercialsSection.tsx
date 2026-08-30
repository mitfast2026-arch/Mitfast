'use client';

import React from 'react';
import ProductFormSection, { FormField, FormGrid } from '../ProductFormSection';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';
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

  const effectiveDiscount =
    values.discountEnabled && values.discount !== '' ? Number(values.discount) : 0;
  const pricing = calculatePricing({
    supplier_price: Number(values.supplierPrice) || 0,
    profit_type: values.profitType,
    profit_value: Number(values.profit) || 0,
    discount: effectiveDiscount,
    gst_rate: Number(values.gst) || 0,
    gst_included: values.gstIncluded,
  });

  const liveProfitType = product?.profit_type === 'fixed' ? 'fixed' : 'percentage';
  const liveProfitValue = product?.profit_value ?? (values.profit !== '' ? Number(values.profit) : 0);
  const marginSummary =
    liveProfitType === 'fixed'
      ? `₹${liveProfitValue.toLocaleString('en-IN')}`
      : `${liveProfitValue}%`;

  function handleProfitTypeChange(nextType: 'percentage' | 'fixed') {
    if (nextType === values.profitType) return;
    const base = Math.max(0, Number(values.supplierPrice) || 0);
    const current = Math.max(0, Number(values.profit) || 0);
    let converted = current;
    if (nextType === 'fixed') {
      converted = Math.round(base * (current / 100) * 100) / 100;
    } else if (base > 0) {
      converted = Math.round((current / base) * 10000) / 100;
    } else {
      converted = 0;
    }
    onChange({ profitType: nextType, profit: converted });
  }

  const marginPreviewLabel =
    values.profitType === 'percentage'
      ? `List price (+${values.profit !== '' ? values.profit : 0}% margin)`
      : `List price (+₹${(values.profit !== '' ? Number(values.profit) : 0).toLocaleString('en-IN')} margin)`;

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
            {(product.suggested_moq != null || (values.suggestedMoq !== '' && Number(values.suggestedMoq) > 0)) && (
              <>
                <div className="text-portal-muted">Suggested MOQ (supplier)</div>
                <div className="text-portal-text text-right">
                  {(product.suggested_moq ?? values.suggestedMoq).toLocaleString('en-IN')}
                </div>
              </>
            )}
            <div className="text-portal-muted">Catalog MOQ</div>
            <div className="text-portal-text text-right">{(product.moq ?? (values.moq !== '' ? values.moq : 100)).toLocaleString('en-IN')}</div>
            <div className="text-portal-muted">Margin</div>
            <div className="text-portal-text text-right">{marginSummary}</div>
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
          <FormField label="Your factory price (₹)" required error={errors.supplierPrice} fieldKey="supplierPrice">
            <input
              type="number"
              min={0}
              step="any"
              placeholder="0.00"
              disabled={readOnly}
              value={values.supplierPrice}
              onChange={(e) =>
                onChange({
                  supplierPrice: e.target.value === '' ? '' : parseFloat(e.target.value),
                })
              }
              className="saas-input type-metric text-xs"
            />
          </FormField>
          <FormField label="Suggested MOQ" required error={errors.suggestedMoq} fieldKey="suggestedMoq">
            <input
              type="number"
              min={1}
              placeholder="100"
              disabled={readOnly}
              value={values.suggestedMoq}
              onChange={(e) =>
                onChange({
                  suggestedMoq: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                })
              }
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
            <FormField label="Factory / base price (₹)" required error={errors.supplierPrice} fieldKey="supplierPrice">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0.00"
                disabled={supplierFieldsDisabled}
                value={values.supplierPrice}
                onChange={(e) =>
                  onChange({
                    supplierPrice: e.target.value === '' ? '' : parseFloat(e.target.value),
                  })
                }
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
            <FormField label="Catalog MOQ" required error={errors.moq} fieldKey="moq">
              <input
                type="number"
                min={1}
                placeholder="100"
                disabled={readOnly}
                value={values.moq}
                onChange={(e) =>
                  onChange({
                    moq: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                  })
                }
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField
              label={
                values.profitType === 'percentage'
                  ? 'Margin / profit (%)'
                  : 'Margin / profit (₹)'
              }
              required
              error={errors.profit}
              fieldKey="profit"
            >
              <div className="flex gap-2">
                <div className="flex shrink-0 rounded-md border border-portal-border overflow-hidden">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => handleProfitTypeChange('percentage')}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      values.profitType === 'percentage'
                        ? 'bg-portal-accent text-white'
                        : 'bg-portal-panel text-portal-muted hover:text-portal-text'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => handleProfitTypeChange('fixed')}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-portal-border ${
                      values.profitType === 'fixed'
                        ? 'bg-portal-accent text-white'
                        : 'bg-portal-panel text-portal-muted hover:text-portal-text'
                    }`}
                  >
                    ₹
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  disabled={readOnly}
                  value={values.profit}
                  onChange={(e) =>
                    onChange({
                      profit: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="saas-input type-metric text-xs flex-1 min-w-0"
                />
              </div>
            </FormField>
            <FormField label="GST rate (%)" optional error={errors.gst} fieldKey="gst">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                disabled={readOnly}
                value={values.gst}
                onChange={(e) =>
                  onChange({
                    gst: e.target.value === '' ? '' : parseFloat(e.target.value),
                  })
                }
                className="saas-input type-metric text-xs"
              />
            </FormField>
            <FormField label="Min order value (₹)" optional>
              <input
                type="number"
                min={0}
                placeholder="0"
                disabled={readOnly}
                value={values.minValue}
                onChange={(e) =>
                  onChange({
                    minValue: e.target.value === '' ? '' : parseFloat(e.target.value),
                  })
                }
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
                  discount: e.target.checked ? values.discount : '',
                })
              }
              className="rounded border-portal-border"
            />
            Apply unit discount
          </label>

          {values.discountEnabled && (
            <FormField label="Discount (₹ / unit)" optional error={errors.discount} fieldKey="discount">
              <input
                type="number"
                min={0}
                placeholder="0"
                disabled={readOnly}
                value={values.discount}
                onChange={(e) =>
                  onChange({
                    discount: e.target.value === '' ? '' : parseFloat(e.target.value),
                  })
                }
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

          <div className="text-xs text-portal-muted bg-portal-panel border border-portal-border rounded-xl p-3.5 space-y-2 font-mono">
            <div className="flex justify-between">
              <span>Factory / Base price</span>
              <span className="text-portal-text font-medium">₹{pricing.supplier_price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>{marginPreviewLabel}</span>
              <span className="text-portal-text">+₹{pricing.profit_amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-portal-muted">
              <span>List price (pre-discount)</span>
              <span className="text-portal-text">₹{pricing.selling_price.toLocaleString('en-IN')}</span>
            </div>
            {values.discountEnabled && pricing.discount > 0 && (
              <div className="flex justify-between text-portal-warning">
                <span>Unit discount</span>
                <span>−₹{pricing.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-portal-border">
              <span className="text-portal-text">Catalog Selling price</span>
              <span className="text-portal-text">₹{pricing.discounted_unit_price.toLocaleString('en-IN')}</span>
            </div>

            {/* GST breakdown */}
            <div className="pt-1.5 border-t border-portal-border/60 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>
                  GST ({pricing.gst_rate}%) {pricing.gst_included ? 'Included in price' : 'Excluded (added at checkout)'}
                </span>
                <span className={pricing.gst_included ? 'text-portal-muted font-medium' : 'text-portal-text font-medium'}>
                  {pricing.gst_included
                    ? `[₹${pricing.gst_amount_per_unit.toLocaleString('en-IN')}]`
                    : `+₹${pricing.gst_amount_per_unit.toLocaleString('en-IN')}`}
                </span>
              </div>
              {pricing.gst_included && (
                <div className="flex justify-between text-portal-muted text-[10px]">
                  <span>Taxable base (ex-GST)</span>
                  <span>₹{pricing.subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-bold pt-1.5 border-t border-portal-border text-xs">
              <span className="text-portal-text">Final Customer Pays (Unit)</span>
              <span className="text-portal-success">₹{pricing.final_unit_price.toLocaleString('en-IN')}</span>
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
