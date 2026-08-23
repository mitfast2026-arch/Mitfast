'use client';

import React from 'react';
import { computeCustomerPrice, computeListPrice } from './types';

type ProductPricingSectionProps = {
  supplierPrice: number;
  profit: number;
  discount: number;
  gst: number;
  gstIncluded: boolean;
  minValue: number;
  onSupplierPriceChange: (v: number) => void;
  onProfitChange: (v: number) => void;
  onDiscountChange: (v: number) => void;
  onGstChange: (v: number) => void;
  onGstIncludedChange: (v: boolean) => void;
  onMinValueChange: (v: number) => void;
};

export default function ProductPricingSection({
  supplierPrice,
  profit,
  discount,
  gst,
  gstIncluded,
  minValue,
  onSupplierPriceChange,
  onProfitChange,
  onDiscountChange,
  onGstChange,
  onGstIncludedChange,
  onMinValueChange,
}: ProductPricingSectionProps) {
  const listPrice = computeListPrice(supplierPrice, profit);
  const marginAmount = Math.round((supplierPrice * (profit / 100)) * 100) / 100;
  const customerPrice = computeCustomerPrice(listPrice, discount);

  return (
    <section id="panel-pricing" className="space-y-4 scroll-mt-4">
      <h4 className="type-section text-sm border-b border-portal-border pb-2">Pricing</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="saas-label">Supplier actual price (₹) *</label>
          <input
            type="number"
            required
            min={0}
            step="any"
            value={supplierPrice}
            onChange={(e) => onSupplierPriceChange(parseFloat(e.target.value) || 0)}
            className="saas-input type-metric"
          />
        </div>
        <div>
          <label className="saas-label">Our margin (%)</label>
          <input
            type="number"
            min={0}
            value={profit}
            onChange={(e) => onProfitChange(parseFloat(e.target.value) || 0)}
            className="saas-input type-metric"
          />
        </div>
        <div>
          <label className="saas-label">Optional discount (₹ / unit)</label>
          <input
            type="number"
            min={0}
            value={discount}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            className="saas-input type-metric"
          />
        </div>
        <div>
          <label className="saas-label">GST rate (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={gst}
            onChange={(e) => onGstChange(parseFloat(e.target.value) || 0)}
            className="saas-input type-metric"
          />
        </div>
        <div className="col-span-2">
          <label className="saas-label">Min order value (₹)</label>
          <input
            type="number"
            min={0}
            value={minValue}
            onChange={(e) => onMinValueChange(parseFloat(e.target.value) || 0)}
            className="saas-input type-metric"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-portal-text cursor-pointer">
        <input
          type="checkbox"
          checked={gstIncluded}
          onChange={(e) => onGstIncludedChange(e.target.checked)}
          className="rounded border-portal-border"
        />
        GST included in supplier price
      </label>

      <div className="text-xs text-portal-muted bg-portal-inset rounded-lg p-3 space-y-1 font-mono">
        <div className="flex justify-between">
          <span>Supplier price</span>
          <span className="text-portal-text">₹{supplierPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span>+ Margin ({profit}%)</span>
          <span className="text-portal-text">₹{marginAmount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span>− Discount</span>
          <span className="text-portal-text">₹{discount.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between border-t border-portal-border pt-1 mt-1">
          <span className="font-medium text-portal-text">List price</span>
          <span className="font-medium text-portal-text">₹{listPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium text-portal-text">Customer pays</span>
          <span className="font-medium text-portal-success">₹{customerPrice.toLocaleString('en-IN')}</span>
        </div>
        {gst > 0 && (
          <div className="flex justify-between text-[10px] pt-1">
            <span>GST ({gst}%){gstIncluded ? ' included' : ''}</span>
          </div>
        )}
      </div>
    </section>
  );
}
