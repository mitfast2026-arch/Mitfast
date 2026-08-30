'use client';

import React from 'react';
import { X, Loader2, Archive } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';
import type { CategoryListItem } from '@/types/category';

type CategoryArchiveDialogProps = {
  category: CategoryListItem;
  archiving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CategoryArchiveDialog({
  category,
  archiving,
  error,
  onClose,
  onConfirm,
}: CategoryArchiveDialogProps) {
  return (
    <OverlayPortal
      open
      layer="modal"
      onEscape={onClose}
      className="flex items-center justify-center p-4 bg-portal-text/50"
    >
      <div className="relative w-full max-w-md p-5 rounded-2xl bg-portal-panel shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-portal-warning" />
            <h3 className="text-sm font-bold text-portal-text">Archive category?</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-portal-muted hover:text-portal-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-portal-muted leading-relaxed">
          <strong className="text-portal-text">{category.name}</strong> will be hidden from the public
          catalog and product assignment dropdowns.
          {category.productCount > 0 && (
            <>
              {' '}
              Its {category.productCount} assigned product{category.productCount !== 1 ? 's' : ''} will
              keep their category link.
            </>
          )}
        </p>
        {error && (
          <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-portal-border">
          <button onClick={onClose} className="saas-btn-secondary text-xs py-1.5 px-3">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={archiving}
            className="saas-btn-primary text-xs py-1.5 px-4 bg-portal-warning hover:opacity-90 border-portal-warning"
          >
            {archiving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Archiving…
              </span>
            ) : (
              'Confirm archive'
            )}
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
