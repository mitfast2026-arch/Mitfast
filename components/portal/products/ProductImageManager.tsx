'use client';

import React, { useRef } from 'react';
import { Upload, X, GripVertical, Loader2 } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import type { ProductImageItem } from './product-form.types';

type ProductImageManagerProps = {
  productId?: string;
  images: ProductImageItem[];
  pendingFiles: File[];
  onImagesChange: (images: ProductImageItem[]) => void;
  onPendingFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxImages?: number;
  onUploadError?: (message: string) => void;
};

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export default function ProductImageManager({
  productId,
  images,
  pendingFiles,
  onImagesChange,
  onPendingFilesChange,
  disabled,
  maxImages = 8,
  onUploadError,
}: ProductImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  const totalCount = images.length + pendingFiles.length;
  const canAdd = !disabled && totalCount < maxImages;

  function reportError(message: string) {
    onUploadError?.(message);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const oversized = files.find((f) => f.size > PRODUCT_IMAGE_MAX_BYTES);
    if (oversized) {
      reportError(`${oversized.name} exceeds 5 MB limit`);
      e.target.value = '';
      return;
    }
    const allowed = files.slice(0, maxImages - totalCount);
    onPendingFilesChange([...pendingFiles, ...allowed]);
    e.target.value = '';
  }

  async function uploadPendingFiles(targetProductId: string) {
    for (const file of pendingFiles) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('isPrimary', images.length === 0 && pendingFiles[0] === file ? 'true' : 'false');
      const res = await fetch(`/api/products/${targetProductId}/images`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Failed to upload ${file.name}`);
      }
    }
    onPendingFilesChange([]);
  }

  async function removeImage(img: ProductImageItem, idx: number) {
    if (img.id && productId) {
      setUploading(true);
      try {
        const res = await fetch(`/api/products/${productId}/images?imageId=${img.id}`, {
          method: 'DELETE',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          reportError(json.error?.message || 'Failed to delete image');
          return;
        }
      } finally {
        setUploading(false);
      }
    }
    onImagesChange(images.filter((_, i) => i !== idx));
  }

  function removePending(idx: number) {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== idx));
  }

  async function moveImage(from: number, to: number) {
    if (from === to) return;
    const previous = images;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onImagesChange(next);
    if (productId && next.every((i) => i.id)) {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedImageIds: next.map((i) => i.id) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        onImagesChange(previous);
        reportError(json.error?.message || 'Failed to reorder images');
      }
    }
  }

  const pendingPreviews = pendingFiles.map((f) => ({
    url: URL.createObjectURL(f),
    file: f,
  }));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <div
            key={img.id || img.image_url}
            draggable={!disabled && !!productId}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) moveImage(dragIdx, idx);
              setDragIdx(null);
            }}
            className="relative aspect-square rounded-md bg-portal-inset border border-portal-border overflow-hidden group"
          >
            <RemoteImage src={img.image_url} alt="" sizes="80px" />
            {idx === 0 && (
              <span className="absolute top-1 left-1 text-[9px] bg-portal-hero text-portal-hero-text px-1 rounded">Primary</span>
            )}
            {!disabled && (
              <>
                <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 cursor-grab">
                  <GripVertical className="w-3 h-3 text-white drop-shadow" />
                </span>
                <button
                  type="button"
                  onClick={() => removeImage(img, idx)}
                  className="absolute bottom-1 right-1 p-0.5 rounded bg-portal-panel/90 text-portal-danger opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
        {pendingPreviews.map((p, idx) => (
          <div key={`pending-${idx}`} className="relative aspect-square rounded-md bg-portal-inset border border-dashed border-portal-border overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            <span className="absolute top-1 left-1 text-[9px] bg-portal-muted text-white px-1 rounded">New</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removePending(idx)}
                className="absolute bottom-1 right-1 p-0.5 rounded bg-portal-panel/90 text-portal-danger"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-md border border-dashed border-portal-border flex flex-col items-center justify-center gap-1 text-portal-muted hover:border-portal-text hover:text-portal-text transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="text-[10px]">Upload</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <p className="text-[11px] text-portal-muted">
        {totalCount}/{maxImages} images · Preferred: WebP · JPEG/PNG ok · max 5 MB · 1600px recommended
      </p>
    </div>
  );
}

export { uploadPendingFilesForProduct };
async function uploadPendingFilesForProduct(productId: string, files: File[], isFirstPrimary: boolean) {
  for (let i = 0; i < files.length; i++) {
    const fd = new FormData();
    fd.append('file', files[i]);
    fd.append('isPrimary', i === 0 && isFirstPrimary ? 'true' : 'false');
    const res = await fetch(`/api/products/${productId}/images`, { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to upload ${files[i].name}`);
    }
  }
}
