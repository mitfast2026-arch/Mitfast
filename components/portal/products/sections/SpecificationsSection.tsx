'use client';

import React from 'react';
import ProductFormSection from '../ProductFormSection';
import SpecificationSheet from '../SpecificationSheet';
import type { ProductFormMode, ProductFormValues } from '../product-form.types';

type SpecificationsSectionProps = {
  values: ProductFormValues;
  errors: Record<string, string>;
  mode: ProductFormMode;
  onChange: (patch: Partial<ProductFormValues>) => void;
};

export default function SpecificationsSection({
  values,
  errors,
  mode,
  onChange,
}: SpecificationsSectionProps) {
  const readOnly = false;

  return (
    <ProductFormSection
      id="section-specs"
      title="Specifications"
      defaultOpen={false}
      badge={values.specRows.length ? String(values.specRows.length) : undefined}
    >
      <SpecificationSheet
        rows={values.specRows}
        disabled={readOnly}
        onChange={(specRows) => onChange({ specRows })}
      />
      {errors.specRows && <p className="text-[11px] text-portal-danger">{errors.specRows}</p>}
    </ProductFormSection>
  );
}
