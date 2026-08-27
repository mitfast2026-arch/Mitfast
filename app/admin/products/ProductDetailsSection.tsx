'use client';

import React from 'react';
import SpecificationSheet from './SpecificationSheet';
import type { SpecRow } from './types';

type ProductDetailsSectionProps = {
  name: string;
  categoryId: string;
  description: string;
  sku: string;
  moq: number;
  ribbon: string;
  specRows: SpecRow[];
  categories: { id: string; name: string }[];
  onNameChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSkuChange: (v: string) => void;
  onMoqChange: (v: number) => void;
  onRibbonChange: (v: string) => void;
  onSpecRowsChange: (rows: SpecRow[]) => void;
};

export default function ProductDetailsSection({
  name,
  categoryId,
  description,
  sku,
  moq,
  ribbon,
  specRows,
  categories,
  onNameChange,
  onCategoryChange,
  onDescriptionChange,
  onSkuChange,
  onMoqChange,
  onRibbonChange,
  onSpecRowsChange,
}: ProductDetailsSectionProps) {
  return (
    <section id="panel-details" className="space-y-4 scroll-mt-4">
      <h4 className="type-section text-sm border-b border-portal-border pb-2">Product Details</h4>

      <div>
        <label className="saas-label">Product Name *</label>
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="saas-input"
        />
      </div>

      <div>
        <label className="saas-label">Category *</label>
        <select
          required
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="saas-input text-xs"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="saas-label">Product Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="saas-input text-xs resize-y"
          placeholder="Describe the product…"
        />
      </div>

      <SpecificationSheet rows={specRows} onChange={onSpecRowsChange} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="saas-label">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => onSkuChange(e.target.value)}
            className="saas-input text-xs"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="saas-label">MOQ *</label>
          <input
            type="number"
            required
            min={1}
            value={moq}
            onChange={(e) => onMoqChange(parseInt(e.target.value) || 1)}
            className="saas-input type-metric"
          />
        </div>
        <div className="col-span-2">
          <label className="saas-label">Ribbon badge</label>
          <input
            type="text"
            value={ribbon}
            onChange={(e) => onRibbonChange(e.target.value)}
            className="saas-input text-xs"
            placeholder="e.g. Featured"
          />
        </div>
      </div>
    </section>
  );
}
