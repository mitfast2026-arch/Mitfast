'use client';

import React from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import OverlayPortal from '@/components/ui/OverlayPortal';
import type { AdminProduct } from './types';
import { getProductImageUrl } from './types';

type ProductDeleteDialogProps = {
  product: AdminProduct;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ProductDeleteDialog({
  product,
  confirmName,
  onConfirmNameChange,
  deleting,
  error,
  onClose,
  onConfirm,
}: ProductDeleteDialogProps) {
  const imageUrl = getProductImageUrl(product);
  const nameMatches = confirmName.trim() === product.name;
  const isPublished = product.publication_status === 'published';
  const isArchived = product.archive_status === 'archived';
  const canHardDelete = !isPublished && isArchived;

  return (
    <OverlayPortal
      open
      layer="modal"
      onEscape={onClose}
      className="flex items-center justify-center p-4 bg-portal-text/50"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-portal-panel shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-portal-border">
          <h3 className="text-base font-medium text-portal-text">Delete product</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-portal-muted hover:text-portal-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <div className="relative w-16 h-16 rounded-lg bg-portal-inset overflow-hidden shrink-0">
              {imageUrl && <RemoteImage src={imageUrl} alt={product.name} sizes="64px" />}
            </div>
            <div>
              <p className="text-sm font-medium text-portal-text">{product.name}</p>
              <p className="text-xs text-portal-muted mt-0.5">
                This permanently removes the product. Orders and RFQs keep their history but lose the product link.
              </p>
            </div>
          </div>

          {isPublished && (
            <div className="text-xs text-portal-warning bg-portal-warning-soft rounded-lg p-2.5">
              Unpublish this product before deleting it.
            </div>
          )}

          {!isPublished && !isArchived && (
            <div className="text-xs text-portal-warning bg-portal-warning-soft rounded-lg p-2.5">
              Archive this product before hard-deleting it.
            </div>
          )}

          {error && (
            <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5">{error}</div>
          )}

          {canHardDelete && (
            <div>
              <label className="saas-label">
                Type <strong>{product.name}</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => onConfirmNameChange(e.target.value)}
                className="saas-input text-xs mt-1"
                placeholder={product.name}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-portal-border bg-portal-inset">
          <button type="button" onClick={onClose} className="saas-btn-secondary text-xs py-2 px-3">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || !canHardDelete || !nameMatches}
            className="text-xs py-2 px-4 rounded-lg bg-portal-danger text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
