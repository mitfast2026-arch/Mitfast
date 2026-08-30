'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import ProductFormSection, { FormField, FormGrid } from '../ProductFormSection';
import type { ProductFormMode, ProductFormValues } from '../product-form.types';

const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="saas-input text-xs min-h-[160px] flex items-center text-portal-muted px-3">
      Loading editor…
    </div>
  ),
});

type ProductInfoSectionProps = {
  values: ProductFormValues;
  errors: Record<string, string>;
  categories: { id: string; name: string }[];
  mode: ProductFormMode;
  onChange: (patch: Partial<ProductFormValues>) => void;
};

export default function ProductInfoSection({
  values,
  errors,
  categories,
  mode,
  onChange,
}: ProductInfoSectionProps) {
  const isAdmin = mode.includes('admin');
  const readOnly = false;

  return (
    <ProductFormSection id="section-info" title="Product Information" defaultOpen>
      <FormField label="Product name" required error={errors.name} fieldKey="name">
        <input
          type="text"
          required
          disabled={readOnly}
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Inconel 718 Hex Cap Bolt M10×50"
          className="saas-input text-xs"
        />
      </FormField>

      <FormGrid>
        <FormField label="Category" required error={errors.categoryId} fieldKey="categoryId">
          <select
            required
            disabled={readOnly}
            value={values.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            className="saas-input text-xs"
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
        {isAdmin && (
          <FormField label="Ribbon badge" optional>
            <input
              type="text"
              disabled={readOnly}
              value={values.ribbon}
              onChange={(e) => onChange({ ribbon: e.target.value })}
              placeholder="Optional badge"
              className="saas-input text-xs"
            />
          </FormField>
        )}
      </FormGrid>

      <FormField label="Description" optional error={errors.description} fieldKey="description">
        <RichTextEditor
          value={values.description}
          onChange={(description) => onChange({ description })}
          productName={values.name}
          placeholder="Describe the product, key features, specifications, applications, benefits, and included items…"
          readOnly={readOnly}
        />
      </FormField>
    </ProductFormSection>
  );
}
