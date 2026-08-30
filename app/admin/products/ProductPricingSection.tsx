'use client';

import React from 'react';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';

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
  const pricing = calculatePricing({
    supplier_price: supplierPrice,
    profit_type: 'percentage',
    profit_value: profit,
    discount: discount,
    gst_rate: gst,
    gst_included: gstIncluded,
  });

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

      <div className="text-xs text-portal-muted bg-portal-inset rounded-lg p-3 space-y-1.5 font-mono">
        <div className="flex justify-between">
          <span>Supplier price</span>
          <span className="text-portal-text">₹{pricing.supplier_price.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span>+ Margin ({profit}%)</span>
          <span className="text-portal-text">+₹{pricing.profit_amount.toLocaleString('en-IN')}</span>
        </div>
        {pricing.discount > 0 && (
          <div className="flex justify-between text-portal-warning">
            <span>− Discount</span>
            <span>−₹{pricing.discount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-portal-border pt-1 mt-1">
          <span className="font-medium text-portal-text">Catalog Selling price</span>
          <span className="font-medium text-portal-text">₹{pricing.discounted_unit_price.toLocaleString('en-IN')}</span>
        </div>
        
        <div className="pt-1 text-[11px] space-y-1">
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
          <span className="font-medium text-portal-text">Final Customer Pays (Unit)</span>
          <span className="font-medium text-portal-success">₹{pricing.final_unit_price.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </section>
  );
}
