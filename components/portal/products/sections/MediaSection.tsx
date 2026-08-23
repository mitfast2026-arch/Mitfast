'use client';

import React from 'react';
import ProductFormSection from '../ProductFormSection';
import ProductImageManager from '../ProductImageManager';
import type { ProductFormMode, ProductFormValues } from '../product-form.types';

type MediaSectionProps = {
  productId?: string;
  values: ProductFormValues;
  mode: ProductFormMode;
  onChange: (patch: Partial<ProductFormValues>) => void;
};

export default function MediaSection({ productId, values, mode, onChange }: MediaSectionProps) {
  const readOnly = false;

  return (
    <ProductFormSection id="section-media" title="Media" defaultOpen={false} badge={`${values.images.length + values.pendingImageFiles.length}/8`}>
      <ProductImageManager
        productId={productId}
        images={values.images}
        pendingFiles={values.pendingImageFiles}
        onImagesChange={(images) => onChange({ images })}
        onPendingFilesChange={(pendingImageFiles) => onChange({ pendingImageFiles })}
        disabled={readOnly}
      />
    </ProductFormSection>
  );
}
