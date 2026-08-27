'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { resolveLocationCountry } from '@/app/admin/products/ProductSupplierSection';
import ProductInfoSection from './sections/ProductInfoSection';
import SupplierOwnershipSection from './sections/SupplierOwnershipSection';
import PricingCommercialsSection from './sections/PricingCommercialsSection';
import InventorySection from './sections/InventorySection';
import MediaSection from './sections/MediaSection';
import SpecificationsSection from './sections/SpecificationsSection';
import {
  EMPTY_PRODUCT_FORM,
  type ProductFormMode,
  type ProductFormProduct,
  type ProductFormValues,
  type CategoryOption,
  type SupplierOption,
} from './product-form.types';
import {
  buildPayload,
  productToFormValues,
  validateFormValues,
} from './product-form.utils';
import { uploadPendingFilesForProduct } from './ProductImageManager';

export type ProductFormPanelProps = {
  open: boolean;
  mode: ProductFormMode;
  product?: ProductFormProduct | null;
  categories: CategoryOption[];
  suppliers?: SupplierOption[];
  supplierName?: string;
  defaultGstRate?: number;
  detailLoading?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onApprove?: () => void;
  onTogglePublish?: () => void;
  onToggleArchive?: () => void;
  isPending?: (key: string) => boolean;
  mutationKey?: (id: string, action: string) => string;
};

function modeTitle(mode: ProductFormMode, product?: ProductFormProduct | null): string {
  switch (mode) {
    case 'create-admin':
      return 'Create Product';
    case 'create-supplier':
      return 'Add New Product';
    case 'edit-admin':
      return product?.name || 'Edit Product';
    case 'edit-supplier':
      return 'Propose Update';
    case 'review-admin':
      return 'Review Submission';
    default:
      return 'Product';
  }
}

function modeSubtitle(mode: ProductFormMode): string {
  switch (mode) {
    case 'create-supplier':
    case 'edit-supplier':
      return 'Changes require admin approval before going live';
    case 'review-admin':
      return 'Compare proposed vs approved pricing';
    case 'create-admin':
      return 'Add to catalog — supplier optional';
    default:
      return 'Product management';
  }
}

export default function ProductFormPanel({
  open,
  mode,
  product,
  categories,
  suppliers = [],
  supplierName,
  defaultGstRate = 18,
  detailLoading = false,
  onClose,
  onSuccess,
  onApprove,
  onTogglePublish,
  onToggleArchive,
  isPending,
  mutationKey,
}: ProductFormPanelProps) {
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState('');
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDirty = initialSnapshot !== '' && JSON.stringify(values) !== initialSnapshot;

  const resetForm = useCallback(
    (p?: ProductFormProduct | null) => {
      if (p) {
        const next = productToFormValues(p);
        setValues(next);
        setInitialSnapshot(JSON.stringify(next));
      } else {
        const next = { ...EMPTY_PRODUCT_FORM, gst: defaultGstRate };
        setValues(next);
        setInitialSnapshot(JSON.stringify(next));
      }
      setErrors({});
      setFormError('');
    },
    [defaultGstRate]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (product) {
      resetForm(product);
    } else {
      resetForm(null);
    }
  }, [open, product, resetForm]);

  const handleCloseAttempt = useCallback(() => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCloseAttempt();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleCloseAttempt]);

  useEffect(() => {
    if (!open || !isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, isDirty]);

  function patch(patch: Partial<ProductFormValues>) {
    setValues((v) => ({ ...v, ...patch }));
  }

  async function handleCopyId() {
    if (!values.supplierId) return;
    try {
      await navigator.clipboard.writeText(values.supplierId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function uploadImages(productId: string) {
    if (values.pendingImageFiles.length > 0) {
      await uploadPendingFilesForProduct(
        productId,
        values.pendingImageFiles,
        values.images.length === 0
      );
    }
  }

  async function saveSupplierCountry() {
    if (!values.supplierId) return;
    const country = resolveLocationCountry(values.locationMode, values.locationOther);
    if (country) {
      await fetch(`/api/suppliers/${values.supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
      });
    }
  }

  async function handleSubmit(finalize = true): Promise<boolean> {
    setFormError('');
    const draft = !finalize && mode === 'create-admin';
    const fieldErrors = validateFormValues(values, mode, { draft });
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const payload = buildPayload(values, categories);

      if (mode === 'create-admin') {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, isDraft: draft }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFormError(json.error?.message || 'Failed to create product');
          return false;
        }
        const id = json.data?.productId;
        if (id) {
          await uploadImages(id);
          await saveSupplierCountry();
        }
        onSuccess();
        onClose();
        return true;
      }

      if (mode === 'create-supplier') {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFormError(json.error?.message || 'Failed to submit product');
          return false;
        }
        const id = json.data?.productId;
        if (id) await uploadImages(id);
        onSuccess();
        onClose();
        return true;
      }

      if (!product) return false;

      if (mode === 'edit-supplier') {
        const res = await fetch(`/api/products/${product.id}/update-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, ...payload }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFormError(json.error?.message || 'Failed to submit update');
          return false;
        }
        onSuccess();
        onClose();
        return true;
      }

      if (mode === 'edit-admin' || mode === 'review-admin') {
        const res = await fetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, ...payload, isDraft: false }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFormError(json.error?.message || 'Failed to save product');
          return false;
        }
        await saveSupplierCountry();
        if (mode === 'edit-admin') {
          onSuccess();
          onClose();
        }
        return true;
      }

      return false;
    } catch {
      setFormError('Something went wrong. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setFormError('');
    const fieldErrors = validateFormValues(values, mode, { draft: true });
    if (fieldErrors.name) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(values, categories);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, isDraft: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to save draft');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setFormError('Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprovalAction(action: 'approve' | 'reject' | 'changes') {
    const requestId = product?.pendingRequest?.id;
    if (!requestId) {
      if (action === 'approve' && onApprove) {
        onApprove();
        onSuccess();
        onClose();
      }
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      if (action === 'approve') {
        if (product && (mode === 'review-admin' || mode === 'edit-admin')) {
          const saved = await handleSubmit(true);
          if (!saved) return;
        }
        const result = await apiPost(`/api/products/requests/${requestId}/approve`);
        if (!result.ok) {
          setFormError(result.message);
          return;
        }
      } else if (action === 'reject') {
        if (!rejectReason.trim()) {
          setFormError('Rejection reason is required');
          return;
        }
        const result = await apiPost(`/api/products/requests/${requestId}/reject`, {
          rejectionReason: rejectReason.trim(),
        });
        if (!result.ok) {
          setFormError(result.message);
          return;
        }
        setRejectOpen(false);
      } else {
        if (!changesNote.trim()) {
          setFormError('Please describe the requested changes');
          return;
        }
        const result = await apiPost(`/api/products/requests/${requestId}/request-changes`, {
          reviewNote: changesNote.trim(),
        });
        if (!result.ok) {
          setFormError(result.message);
          return;
        }
        setChangesOpen(false);
      }
      onSuccess();
      onClose();
    } catch {
      setFormError('Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !mounted) return null;

  const needsApproval =
    product?.approval_status === 'pending' || product?.approval_status === 'update_pending';
  const isPublished = product?.publication_status === 'published';
  const isArchived = product?.archive_status === 'archived';
  const pid = product?.id;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-portal-hero/40 backdrop-blur-sm"
        onClick={handleCloseAttempt}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl max-h-[85vh] bg-portal-panel rounded-xl shadow-2xl flex flex-col overflow-hidden border border-portal-border"
      >
        {/* Sticky header */}
        <div className="shrink-0 px-5 py-4 border-b border-portal-border bg-portal-panel">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-portal-text truncate">
                {detailLoading ? 'Loading…' : modeTitle(mode, product)}
              </h2>
              <p className="text-[11px] text-portal-muted mt-0.5">{modeSubtitle(mode)}</p>
            </div>
            <button
              type="button"
              onClick={handleCloseAttempt}
              className="p-1.5 rounded-md text-portal-muted hover:bg-portal-hover hover:text-portal-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {product && mode.includes('admin') && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-portal-border">
              {product.approval_status && (
                <span
                  className={
                    product.approval_status === 'approved'
                      ? 'saas-badge-success text-[10px]'
                      : 'saas-badge-gold text-[10px]'
                  }
                >
                  {product.approval_status.replace('_', ' ').toUpperCase()}
                </span>
              )}
              {product.publication_status && (
                <span className="saas-badge-neutral text-[10px]">
                  {product.publication_status.toUpperCase()}
                </span>
              )}
              {!product.supplier_id && (
                <span className="saas-badge-neutral text-[10px]">INTERNAL</span>
              )}
              {mode === 'edit-admin' && needsApproval && onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={!!pid && !!isPending?.(mutationKey?.(pid, 'approve') || '')}
                  className="saas-btn-secondary text-[10px] py-1 px-2 ml-auto flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Approve
                </button>
              )}
              {mode === 'edit-admin' && onTogglePublish && (
                <button
                  type="button"
                  onClick={onTogglePublish}
                  className="saas-btn-secondary text-[10px] py-1 px-2 flex items-center gap-1"
                >
                  {isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {isPublished ? 'Unpublish' : 'Publish'}
                </button>
              )}
              {mode === 'edit-admin' && onToggleArchive && (
                <button
                  type="button"
                  onClick={onToggleArchive}
                  className="saas-btn-secondary text-[10px] py-1 px-2 flex items-center gap-1"
                >
                  {isArchived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                  {isArchived ? 'Restore' : 'Archive'}
                </button>
              )}
            </div>
          )}
        </div>

        {formError && (
          <div className="mx-5 mt-3 text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5 shrink-0">
            {formError}
          </div>
        )}

        {/* Scroll body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-portal-inset">
          {detailLoading ? (
            <div className="flex flex-col items-center py-16 text-portal-muted">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Loading product…</span>
            </div>
          ) : (
            <>
              <ProductInfoSection
                values={values}
                errors={errors}
                categories={categories}
                mode={mode}
                onChange={patch}
              />
              <SupplierOwnershipSection
                values={values}
                product={product}
                suppliers={suppliers}
                mode={mode}
                supplierName={supplierName}
                copied={copied}
                onChange={patch}
                onCopyId={handleCopyId}
              />
              <PricingCommercialsSection
                values={values}
                errors={errors}
                product={product}
                mode={mode}
                onChange={patch}
              />
              <InventorySection
                values={values}
                errors={errors}
                categories={categories}
                mode={mode}
                onChange={patch}
              />
              <MediaSection productId={product?.id} values={values} mode={mode} onChange={patch} />
              <SpecificationsSection
                values={values}
                errors={errors}
                mode={mode}
                onChange={patch}
              />
            </>
          )}
        </div>

        {/* Reject / changes mini-prompts */}
        {rejectOpen && (
          <div className="mx-5 mb-2 p-3 rounded-lg border border-portal-danger/30 bg-portal-danger-soft space-y-2">
            <label className="saas-label text-portal-danger">Rejection reason</label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="saas-input text-xs"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejectOpen(false)} className="saas-btn-secondary text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApprovalAction('reject')}
                className="saas-btn-primary text-xs bg-portal-danger"
              >
                Confirm reject
              </button>
            </div>
          </div>
        )}

        {changesOpen && (
          <div className="mx-5 mb-2 p-3 rounded-lg border border-portal-border bg-portal-inset space-y-2">
            <label className="saas-label">Requested changes</label>
            <textarea
              rows={2}
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              className="saas-input text-xs"
              placeholder="Describe what the supplier should revise…"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setChangesOpen(false)} className="saas-btn-secondary text-xs">
                Cancel
              </button>
              <button type="button" onClick={() => handleApprovalAction('changes')} className="saas-btn-primary text-xs">
                Send feedback
              </button>
            </div>
          </div>
        )}

        {/* Sticky footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-portal-border bg-portal-panel">
          <button
            type="button"
            onClick={handleCloseAttempt}
            disabled={submitting}
            className="saas-btn-secondary text-xs py-2 px-3"
          >
            Cancel
          </button>

          {mode === 'create-admin' && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting || detailLoading}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting || detailLoading}
                className="saas-btn-primary text-xs py-2 px-4"
              >
                {submitting ? 'Creating…' : 'Create Product'}
              </button>
            </>
          )}

          {(mode === 'create-supplier' || mode === 'edit-supplier') && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting || detailLoading}
              className="saas-btn-primary text-xs py-2 px-4"
            >
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          )}

          {mode === 'edit-admin' && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting || detailLoading}
              className="saas-btn-primary text-xs py-2 px-4"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          )}

          {mode === 'review-admin' && (
            <>
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={submitting}
                className="saas-btn-secondary text-xs py-2 px-3 text-portal-danger"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setChangesOpen(true)}
                disabled={submitting}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Request Changes
              </button>
              <button
                type="button"
                onClick={() => handleApprovalAction('approve')}
                disabled={submitting}
                className="saas-btn-primary text-xs py-2 px-4"
              >
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export async function loadProductForPanel(
  productId: string,
  role: 'admin' | 'supplier' = 'admin'
): Promise<ProductFormProduct | null> {
  const url =
    role === 'supplier'
      ? `/api/supplier/products/${productId}`
      : `/api/products/${productId}?mode=admin`;
  const result = await apiGet<{ product: ProductFormProduct }>(url);
  return result.ok ? result.data.product : null;
}
