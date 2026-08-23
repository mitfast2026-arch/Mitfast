'use client';

import React from 'react';
import ProductFormSection, { FormField } from '../ProductFormSection';
import { generateSku } from '../product-form.utils';
import type { ProductFormMode, ProductFormValues } from '../product-form.types';

type InventorySectionProps = {
  values: ProductFormValues;
  errors: Record<string, string>;
  categories: { id: string; name: string }[];
  mode: ProductFormMode;
  onChange: (patch: Partial<ProductFormValues>) => void;
};

/** SKU only — availability is controlled by admin publish / archive, not stock qty. */
export default function InventorySection({
  values,
  categories,
  onChange,
}: InventorySectionProps) {
  const catName = categories.find((c) => c.id === values.categoryId)?.name;

  return (
    <ProductFormSection id="section-sku" title="SKU" defaultOpen={false}>
      <FormField label="SKU" optional>
        <div className="flex gap-1">
          <input
            type="text"
            maxLength={64}
            value={values.sku}
            onChange={(e) => onChange({ sku: e.target.value })}
            placeholder="Optional factory SKU"
            className="saas-input text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => onChange({ sku: generateSku(values.name, catName) })}
            className="saas-btn-secondary text-[10px] px-2 shrink-0"
          >
            Generate
          </button>
        </div>
      </FormField>
      <p className="text-[11px] text-portal-muted">
        Availability is managed by publishing or archiving the listing — no stock quantity required.
      </p>
    </ProductFormSection>
  );
}
