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
  hasOpenUpdateRequest?: boolean;
  maxImages?: number;
  uploadProgress?: { done: number; total: number } | null;
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
  hasOpenUpdateRequest,
  maxImages = 8,
  uploadProgress,
}: MediaSectionProps) {
  const readOnly =
    mode.includes('supplier') &&
    publicationStatus === 'published' &&
    mode !== 'edit-supplier';

  const total = values.images.length + values.pendingImageFiles.length;

  return (
    <ProductFormSection id="section-media" title="Media" defaultOpen={false} badge={`${total}/${maxImages}`}>
      <ProductImageManager
        productId={productId}
        images={values.images}
        pendingFiles={values.pendingImageFiles}
        onImagesChange={(images) => onChange({ images })}
        onPendingFilesChange={(pendingImageFiles) => onChange({ pendingImageFiles })}
        disabled={readOnly}
        maxImages={maxImages}
        uploadProgress={uploadProgress}
        onUploadError={onUploadError}
      />
      {readOnly && (
        <p className="text-[11px] text-portal-muted mt-2">
          Image changes on published products require an admin-approved update request. Open this product and submit an update to change images.
        </p>
      )}
      {mode === 'edit-supplier' && publicationStatus === 'published' && (
        <p className="text-[11px] text-portal-muted mt-2">
          Reorder or add images below, then submit for approval. New uploads attach to your update request after you submit.
          {hasOpenUpdateRequest ? ' You can add images now — your pending update is open.' : ''}
        </p>
      )}
    </ProductFormSection>
  );
}
