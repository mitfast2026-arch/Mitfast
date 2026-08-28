'use client';

import React from 'react';
import ProductFormSection from '../ProductFormSection';
import ProductImageManager from '../ProductImageManager';
import type { ProductFormMode, ProductFormValues } from '../product-form.types';

type MediaSectionProps = {
  productId?: string;
  values: ProductFormValues;
  mode: ProductFormMode;
  publicationStatus?: string;
  onChange: (patch: Partial<ProductFormValues>) => void;
  onUploadError?: (message: string) => void;
};

export default function MediaSection({
  productId,
  values,
  mode,
  publicationStatus,
  onChange,
  onUploadError,
}: MediaSectionProps) {
  const supplierPublished =
    mode.includes('supplier') && publicationStatus === 'published';
  const readOnly = supplierPublished;

  return (
    <ProductFormSection id="section-media" title="Media" defaultOpen={false} badge={`${values.images.length + values.pendingImageFiles.length}/8`}>
      <ProductImageManager
        productId={productId}
        images={values.images}
        pendingFiles={values.pendingImageFiles}
        onImagesChange={(images) => onChange({ images })}
        onPendingFilesChange={(pendingImageFiles) => onChange({ pendingImageFiles })}
        disabled={readOnly}
        onUploadError={onUploadError}
      />
      {supplierPublished && (
        <p className="text-[11px] text-portal-muted mt-2">
          Image changes on published products require an admin-approved update request.
        </p>
      )}
    </ProductFormSection>
  );
}
