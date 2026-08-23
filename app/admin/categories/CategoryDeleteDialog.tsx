'use client';

import React from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import type { CategoryListItem } from '@/types/category';

type CategoryDeleteDialogProps = {
  category: CategoryListItem;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CategoryDeleteDialog({
  category,
  confirmName,
  onConfirmNameChange,
  deleting,
  error,
  onClose,
  onConfirm,
}: CategoryDeleteDialogProps) {
  const nameMatches = confirmName.trim() === category.name;

  return (
    <div className="fixed inset-0 z-50 bg-portal-text/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-portal-panel shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-portal-border">
          <h3 className="text-base font-medium text-portal-text">Delete category</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-portal-muted hover:text-portal-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-portal-muted leading-relaxed">
            <strong className="text-portal-text">{category.name}</strong> will be permanently removed.
            This cannot be undone.
          </p>

          {category.productCount > 0 && (
            <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5">
              This category has {category.productCount} product
              {category.productCount !== 1 ? 's' : ''} assigned. Archive it instead, or reassign products
              first.
            </div>
          )}

          {error && (
            <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5">{error}</div>
          )}

          {category.productCount === 0 && (
            <div>
              <label className="saas-label">
                Type <strong>{category.name}</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => onConfirmNameChange(e.target.value)}
                className="saas-input text-xs mt-1"
                placeholder={category.name}
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
            disabled={deleting || category.productCount > 0 || !nameMatches}
            className="text-xs py-2 px-4 rounded-lg bg-portal-danger text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
