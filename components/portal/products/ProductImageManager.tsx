'use client';

import React, { useRef } from 'react';
import { Upload, X, GripVertical, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { createIdempotencyKey } from '@/lib/client/idempotency-key';
import type { ProductImageItem } from './product-form.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when image row exists in DB (not a proposed/snapshot placeholder). */
export function isPersistedImageId(id: string | undefined): boolean {
  if (!id) return false;
  if (id.startsWith('proposed-')) return false;
  return UUID_RE.test(id);
}

export function collectImageUrls(images: ProductImageItem[]): string[] {
  return images.map((img) => img.image_url).filter(Boolean);
}

type ProductImageManagerProps = {
  productId?: string;
  images: ProductImageItem[];
  pendingFiles: File[];
  onImagesChange: (images: ProductImageItem[]) => void;
  onPendingFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxImages?: number;
  onUploadError?: (message: string) => void;
  /** External upload progress (set by form panel during submit) */
  uploadProgress?: { done: number; total: number } | null;
};

/** Align with Vercel ~4.5 MB body limit */
const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 2;
const UPLOAD_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function ProductImageManager({
  productId,
  images,
  pendingFiles,
  onImagesChange,
  onPendingFilesChange,
  disabled,
  maxImages = 8,
  onUploadError,
  uploadProgress,
}: ProductImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorderPendingRef = useRef<string[] | null>(null);

  const totalCount = images.length + pendingFiles.length;
  const canAdd = !disabled && totalCount < maxImages;
  const isBusy = uploading || (uploadProgress != null && uploadProgress.total > 0);

  function reportError(message: string) {
    onUploadError?.(message);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const oversized = files.find((f) => f.size > PRODUCT_IMAGE_MAX_BYTES);
    if (oversized) {
      reportError(`${oversized.name} exceeds 4 MB limit`);
      e.target.value = '';
      return;
    }
    const allowed = files.slice(0, maxImages - totalCount);
    onPendingFilesChange([...pendingFiles, ...allowed]);
    e.target.value = '';
  }

  async function removeImage(img: ProductImageItem, idx: number) {
    if (isPersistedImageId(img.id) && productId) {
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

  async function persistReorder(orderedIds: string[], previous: ProductImageItem[]) {
    if (!productId) return;
    const res = await fetch(`/api/products/${productId}/images`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedImageIds: orderedIds }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      onImagesChange(previous);
      reportError(json.error?.message || 'Failed to reorder images');
    }
  }

  function scheduleReorder(orderedIds: string[], previous: ProductImageItem[]) {
    reorderPendingRef.current = orderedIds;
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(() => {
      const ids = reorderPendingRef.current;
      reorderPendingRef.current = null;
      if (ids) void persistReorder(ids, previous);
    }, 300);
  }

  async function moveImage(from: number, to: number) {
    if (from === to) return;
    const previous = images;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onImagesChange(next);
    const allPersisted = productId && next.every((i) => isPersistedImageId(i.id));
    if (allPersisted) {
      scheduleReorder(
        next.map((i) => i.id as string),
        previous
      );
    }
  }

  React.useEffect(() => {
    return () => {
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    };
  }, []);

  const pendingPreviews = pendingFiles.map((f) => ({
    url: URL.createObjectURL(f),
    file: f,
  }));

  return (
    <div className="space-y-2">
      {uploadProgress && uploadProgress.total > 0 && (
        <div className="rounded-md border border-portal-border bg-portal-inset px-3 py-2 text-[12px] text-portal-muted">
          Uploading images {uploadProgress.done}/{uploadProgress.total}…
          <div className="mt-1 h-1.5 rounded-full bg-portal-border overflow-hidden">
            <div
              className="h-full bg-portal-hero transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((uploadProgress.done / uploadProgress.total) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <div
            key={img.id || img.image_url}
            draggable={!disabled && !isBusy}
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
            {!disabled && !isBusy && (
              <>
                <span className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-grab hidden md:inline-flex">
                  <GripVertical className="w-3 h-3 text-white drop-shadow" />
                </span>
                <div className="absolute bottom-1 left-1 flex flex-col gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Move image up"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx - 1);
                    }}
                    className="min-h-10 min-w-10 md:min-h-7 md:min-w-7 inline-flex items-center justify-center rounded bg-portal-panel/90 text-portal-text disabled:opacity-40"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move image down"
                    disabled={idx === images.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx + 1);
                    }}
                    className="min-h-10 min-w-10 md:min-h-7 md:min-w-7 inline-flex items-center justify-center rounded bg-portal-panel/90 text-portal-text disabled:opacity-40"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => removeImage(img, idx)}
                  className="absolute bottom-1 right-1 min-h-10 min-w-10 inline-flex items-center justify-center rounded bg-portal-panel/90 text-portal-danger opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
        {pendingPreviews.map((p, idx) => (
          <div key={`pending-${idx}`} className="relative aspect-square rounded-md bg-portal-inset border border-dashed border-portal-border overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            <span className="absolute top-1 left-1 text-[9px] bg-portal-muted text-white px-1 rounded">New</span>
            {!disabled && !isBusy && (
              <button
                type="button"
                aria-label="Remove pending image"
                onClick={() => removePending(idx)}
                className="absolute bottom-1 right-1 min-h-10 min-w-10 inline-flex items-center justify-center rounded bg-portal-panel/90 text-portal-danger opacity-100 md:opacity-0 md:group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {canAdd && !isBusy && (
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
        {totalCount}/{maxImages} images · Preferred: WebP · JPEG/PNG ok · max 4 MB · 1600px recommended
      </p>
    </div>
  );
}

export type UploadProgressCallback = (done: number, total: number) => void;

async function uploadOneFile(
  productId: string,
  file: File,
  isPrimary: boolean,
  uploadId: string
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('isPrimary', isPrimary ? 'true' : 'false');
      fd.append('uploadId', uploadId);
      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: fd,
        headers: { 'X-Upload-Id': uploadId },
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) return;

      const code = json.error?.code as string | undefined;
      const retryable =
        res.status === 429 ||
        res.status >= 500 ||
        code === 'RATE_LIMITED' ||
        code === 'IDEMPOTENCY_IN_PROGRESS';

      lastError = new Error(json.error?.message || `Failed to upload ${file.name}`);
      if (!retryable || attempt === MAX_RETRIES - 1) throw lastError;

      const retryAfter = Number(res.headers.get('Retry-After') || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 200 * Math.pow(2, attempt));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error(`Upload timed out for ${file.name}`);
      } else if (err instanceof Error) {
        lastError = err;
      }
      if (attempt === MAX_RETRIES - 1) throw lastError || new Error(`Failed to upload ${file.name}`);
      await sleep(200 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`Failed to upload ${file.name}`);
}

/**
 * Upload pending files with limited concurrency (2), per-file retries, and progress.
 */
export async function uploadPendingFilesForProduct(
  productId: string,
  files: File[],
  isFirstPrimary: boolean,
  onProgress?: UploadProgressCallback
) {
  if (!files.length) return;

  let done = 0;
  onProgress?.(0, files.length);

  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= files.length) return;
      const uploadId = createIdempotencyKey();
      await uploadOneFile(productId, files[i], i === 0 && isFirstPrimary, uploadId);
      done += 1;
      onProgress?.(done, files.length);
    }
  }

  const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, () => worker());
  await Promise.all(workers);
}

export { PRODUCT_IMAGE_MAX_BYTES };
