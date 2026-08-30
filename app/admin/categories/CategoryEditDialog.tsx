'use client';

import React from 'react';
import { X, Loader2, Pencil } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';
import type { CategoryListItem } from '@/types/category';

type CategoryEditDialogProps = {
  category: CategoryListItem;
  name: string;
  onNameChange: (value: string) => void;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
};

export default function CategoryEditDialog({
  category,
  name,
  onNameChange,
  saving,
  error,
  onClose,
  onSave,
}: CategoryEditDialogProps) {
  const trimmed = name.trim();
  const canSave = trimmed.length >= 2 && trimmed !== category.name;

  return (
    <OverlayPortal
      open
      layer="modal"
      onEscape={onClose}
      className="flex items-center justify-center p-4 bg-portal-text/50"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave();
        }}
        className="relative w-full max-w-md p-5 rounded-2xl bg-portal-panel shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-portal-text" />
            <h3 className="text-sm font-bold text-portal-text">Rename category</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-portal-muted hover:text-portal-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="saas-label">Category name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="saas-input text-xs"
            required
            minLength={2}
            autoFocus
          />
        </div>

        {error && (
          <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-portal-border">
          <button type="button" onClick={onClose} className="saas-btn-secondary text-xs py-1.5 px-3">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="saas-btn-primary text-xs py-1.5 px-4"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </OverlayPortal>
  );
}
