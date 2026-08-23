'use client';

import React from 'react';
import { Check, Eye, EyeOff, Archive, RotateCcw, Loader2 } from 'lucide-react';
import type { AdminProduct } from './types';

type ProductStatusSectionProps = {
  product: AdminProduct;
  categoryId: string;
  supplierId: string;
  categories: { id: string; name: string }[];
  suppliers: { id: string; company_name: string }[];
  isPending: (key: string) => boolean;
  mutationKey: (id: string, action: string) => string;
  onCategoryChange: (v: string) => void;
  onSupplierChange: (v: string) => void;
  onApprove: () => void;
  onTogglePublish: () => void;
  onToggleArchive: () => void;
};

export default function ProductStatusSection({
  product,
  categoryId,
  supplierId,
  categories,
  suppliers,
  isPending,
  mutationKey,
  onCategoryChange,
  onSupplierChange,
  onApprove,
  onTogglePublish,
  onToggleArchive,
}: ProductStatusSectionProps) {
  const needsApproval =
    product.approval_status === 'pending' || product.approval_status === 'update_pending';
  const isPublished = product.publication_status === 'published';
  const isArchived = product.archive_status === 'archived';

  return (
    <section id="panel-status" className="space-y-4 scroll-mt-4">
      <h4 className="type-section text-sm border-b border-portal-border pb-2">Status Controls</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="saas-label">Category</label>
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="saas-input text-xs"
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="saas-label">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            className="saas-input text-xs"
          >
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="saas-panel p-4 space-y-3 bg-portal-inset">
        <div className="flex items-center justify-between">
          <span className="text-xs text-portal-muted">Approval</span>
          <div className="flex items-center gap-2">
            <span
              className={
                product.approval_status === 'approved'
                  ? 'saas-badge-success text-[10px]'
                  : 'saas-badge-gold text-[10px]'
              }
            >
              {product.approval_status?.toUpperCase()}
            </span>
            {needsApproval && (
              <button
                type="button"
                onClick={onApprove}
                disabled={isPending(mutationKey(product.id, 'approve'))}
                className="saas-btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 text-portal-success disabled:opacity-50"
              >
                {isPending(mutationKey(product.id, 'approve')) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Approve
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-portal-muted">Catalog visibility</span>
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isPending(mutationKey(product.id, isPublished ? 'unpublish' : 'publish'))}
            className="saas-btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPending(mutationKey(product.id, isPublished ? 'unpublish' : 'publish')) ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isPublished ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-portal-muted">Archive status</span>
          <button
            type="button"
            onClick={onToggleArchive}
            disabled={isPending(mutationKey(product.id, isArchived ? 'restore' : 'archive'))}
            className={`text-[11px] py-1.5 px-3 flex items-center gap-1.5 rounded-lg border disabled:opacity-50 ${
              isArchived
                ? 'border-portal-success/30 bg-portal-panel text-portal-success'
                : 'border-portal-danger/30 bg-portal-panel text-portal-danger'
            }`}
          >
            {isPending(mutationKey(product.id, isArchived ? 'restore' : 'archive')) ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isArchived ? (
              <RotateCcw className="w-3 h-3" />
            ) : (
              <Archive className="w-3 h-3" />
            )}
            {isArchived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </div>
    </section>
  );
}
