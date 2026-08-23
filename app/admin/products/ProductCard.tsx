'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Edit3,
  Eye,
  EyeOff,
  Archive,
  RotateCcw,
  Trash2,
  Check,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import type { AdminProduct } from './types';
import { getProductImageUrl } from './types';
import { StatusPill } from '@/components/portal/ds';

type ProductCardProps = {
  product: AdminProduct;
  isPending: (key: string) => boolean;
  mutationKey: (id: string, action: string) => string;
  detailLoading: boolean;
  selectedProductId?: string;
  onEdit: (product: AdminProduct) => void;
  onApprove: (id: string) => void;
  onTogglePublish: (id: string, status: string) => void;
  onToggleArchive: (id: string, status: string) => void;
  onDelete: (product: AdminProduct) => void;
};

type BadgeItem = { key: string; label: string; tone: 'warning' | 'success' | 'neutral' };

export default function ProductCard({
  product: p,
  isPending,
  mutationKey,
  detailLoading,
  selectedProductId,
  onEdit,
  onApprove,
  onTogglePublish,
  onToggleArchive,
  onDelete,
}: ProductCardProps) {
  const imageUrl = getProductImageUrl(p);
  const isArchived = p.archive_status === 'archived';
  const isPublished = p.publication_status === 'published';
  const needsApproval =
    p.approval_status === 'pending' || p.approval_status === 'update_pending';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const publishKey = mutationKey(p.id, isPublished ? 'unpublish' : 'publish');
  const publishPending = isPending(publishKey);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const badges: BadgeItem[] = [];
  if (needsApproval) {
    badges.push({
      key: 'approval',
      label: p.approval_status === 'update_pending' ? 'Update pending' : 'Pending',
      tone: 'warning',
    });
  }
  badges.push({
    key: 'pub',
    label: (p.publication_status || 'unpublished').replace(/_/g, ' '),
    tone: isPublished ? 'success' : 'neutral',
  });
  badges.push({
    key: 'arch',
    label: isArchived ? 'Archived' : 'Active',
    tone: isArchived ? 'neutral' : 'success',
  });

  const visibleBadges = badges.slice(0, 2);
  const overflow = badges.length - visibleBadges.length;

  const categoryLabel = p.category?.name || '—';
  const supplierLabel = p.supplier?.company_name || 'Unknown';

  return (
    <div
      className={`saas-panel !p-0 overflow-hidden flex flex-col h-full ${isArchived ? 'opacity-60' : ''}`}
    >
      <div className="px-4 pt-4 flex flex-nowrap items-center gap-1.5 overflow-hidden">
        {visibleBadges.map((b) => (
          <StatusPill key={b.key} label={b.label} tone={b.tone} />
        ))}
        {overflow > 0 ? (
          <span
            className="saas-badge-neutral shrink-0"
            title={badges
              .slice(2)
              .map((b) => b.label)
              .join(', ')}
          >
            +{overflow}
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[4/3] bg-portal-inset mx-4 mt-3 rounded-2xl overflow-hidden">
        {imageUrl ? (
          <RemoteImage src={imageUrl} alt={p.name} sizes="(max-width: 1280px) 25vw, 300px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-portal-muted">
            <Package className="w-10 h-10" aria-hidden />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="min-w-0">
          <h3
            className="text-sm font-medium text-portal-text truncate leading-snug"
            title={p.name}
          >
            {p.name}
          </h3>
          <p
            className="text-sm text-portal-muted mt-0.5 truncate"
            title={`${categoryLabel} · ${supplierLabel}`}
          >
            {categoryLabel} · {supplierLabel}
          </p>
          <p className="text-sm text-portal-text mt-1 type-metric">
            ₹{p.selling_price?.toLocaleString('en-IN')} · MOQ {p.moq}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(p)}
            disabled={detailLoading && selectedProductId === p.id}
            className="saas-btn-secondary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {detailLoading && selectedProductId === p.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Edit3 className="w-3.5 h-3.5" />
            )}
            Edit
          </button>
          <button
            type="button"
            onClick={() => onTogglePublish(p.id, p.publication_status || 'unpublished')}
            disabled={publishPending}
            className="saas-btn-secondary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
            aria-busy={publishPending || undefined}
          >
            {publishPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPublished ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="saas-btn-ghost"
              aria-label="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-40 rounded-2xl border border-portal-border bg-portal-panel py-1 shadow-lg z-10">
                {needsApproval && (
                  <button
                    type="button"
                    onClick={() => {
                      onApprove(p.id);
                      setMenuOpen(false);
                    }}
                    disabled={isPending(mutationKey(p.id, 'approve'))}
                    className="w-full text-left px-3 py-2 text-sm text-portal-success hover:bg-portal-hover flex items-center gap-2 disabled:opacity-50"
                  >
                    {isPending(mutationKey(p.id, 'approve')) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onToggleArchive(p.id, p.archive_status || 'active');
                    setMenuOpen(false);
                  }}
                  disabled={isPending(mutationKey(p.id, isArchived ? 'restore' : 'archive'))}
                  className="w-full text-left px-3 py-2 text-sm text-portal-text hover:bg-portal-hover flex items-center gap-2 disabled:opacity-50"
                >
                  {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  {isArchived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(p);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-portal-danger hover:bg-portal-danger-soft flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
