'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Building2,
  Package,
  Check,
  X,
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Eye,
} from 'lucide-react';
import { apiPost } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
  setPortalCache,
} from '@/lib/client/portal-data-cache';
import { invalidateProductPortalCaches } from '@/lib/client/invalidate-product-portal-cache';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PortalModal from '@/components/admin/PortalModal';
import { StatusPill, SkeletonCard } from '@/components/portal/ds';
import { toast } from 'sonner';
import ProductFormPanel, { loadProductForPanel } from '@/components/portal/products/ProductFormPanel';
import type { ProductFormMode, ProductFormProduct } from '@/components/portal/products/product-form.types';

type Tab = 'suppliers' | 'new' | 'updates';

type ApprovalsPayload = {
  pendingSuppliers: any[];
  newProductRequests: any[];
  productUpdateRequests: any[];
};

export default function AdminApprovalsPage() {
  const cached = peekPortalCache<ApprovalsPayload>('/api/admin/approvals');
  const [data, setData] = useState<ApprovalsPayload | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState<Tab>('suppliers');
  const [rejectionTarget, setRejectionTarget] = useState<{ type: 'supplier' | 'product'; id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<any[]>([]);
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ProductFormMode>('review-admin');
  const [panelProduct, setPanelProduct] = useState<ProductFormProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { isPending, run } = useMutation();

  const loadApprovals = useCallback(async (showLoading = true, opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);
    const existing = force ? null : peekPortalCache<ApprovalsPayload>('/api/admin/approvals');
    if (existing) {
      setData(existing.data);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await cachedApiGet<ApprovalsPayload>('/api/admin/approvals', {
        force: force || (showLoading && !existing),
      });
      if (result.ok) {
        setData(result.data);
        markPortalContentReady('/admin/approvals');
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
    void (async () => {
      const [catsRes, supsRes, settingsRes] = await Promise.all([
        cachedApiGet<{ categories: any[] }>('/api/categories?mode=admin&status=active'),
        cachedApiGet<{ suppliers: any[] }>('/api/suppliers?status=active&limit=100'),
        cachedApiGet<{ defaultGstRate?: number }>('/api/settings'),
      ]);
      if (catsRes.ok) setCategories(catsRes.data.categories || []);
      if (supsRes.ok) setSupplierOptions(supsRes.data.suppliers || []);
      if (settingsRes.ok && settingsRes.data?.defaultGstRate != null) {
        setDefaultGstRate(Number(settingsRes.data.defaultGstRate) || 18);
      }
    })();
  }, [loadApprovals]);

  function patchApprovals(updater: (prev: ApprovalsPayload | null) => ApprovalsPayload | null) {
    setData((prev) => {
      const next = updater(prev);
      if (next) setPortalCache('/api/admin/approvals', next);
      return next;
    });
  }

  async function openReviewPanel(productId: string) {
    setPanelOpen(true);
    setPanelMode('review-admin');
    setPanelProduct({ id: productId } as ProductFormProduct);
    setDetailLoading(true);
    try {
      const detail = await loadProductForPanel(productId);
      if (detail) setPanelProduct(detail);
      else {
        toast.error('Failed to load product details');
        setPanelOpen(false);
      }
    } catch {
      toast.error('Failed to load product details');
      setPanelOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeReviewPanel() {
    setPanelOpen(false);
    setPanelProduct(null);
    setDetailLoading(false);
  }

  async function handleApproveSupplier(supplierId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/suppliers/${supplierId}/approve`), {
      key: mutationKey(supplierId, 'approve-supplier'),
      onSuccess: () => {
        patchApprovals((prev) =>
          prev
            ? {
                ...prev,
                pendingSuppliers: (prev.pendingSuppliers || []).filter((s: any) => s.id !== supplierId),
              }
            : prev
        );
        notifyApprovalsChanged();
        toast.success('Supplier approved');
      },
      onError: (msg) => {
        setActionError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleApproveProduct(requestId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/products/requests/${requestId}/approve`), {
      key: mutationKey(requestId, 'approve-product'),
      onSuccess: () => {
        patchApprovals((prev) =>
          prev
            ? {
                ...prev,
                newProductRequests: (prev.newProductRequests || []).filter((r: any) => r.id !== requestId),
                productUpdateRequests: (prev.productUpdateRequests || []).filter(
                  (r: any) => r.id !== requestId
                ),
              }
            : prev
        );
        notifyApprovalsChanged();
        invalidateProductPortalCaches();
        toast.success('Product request approved');
      },
      onError: (msg) => {
        setActionError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleConfirmReject() {
    if (!rejectionTarget || !rejectionReason.trim()) return;
    setActionError(null);
    const target = rejectionTarget;
    const reason = rejectionReason.trim();

    await run(
      () =>
        target.type === 'supplier'
          ? apiPost(`/api/suppliers/${target.id}/reject`, { rejectionReason: reason })
          : apiPost(`/api/products/requests/${target.id}/reject`, { rejectionReason: reason }),
      {
        key: mutationKey(target.id, 'reject'),
        onSuccess: () => {
          if (target.type === 'supplier') {
            patchApprovals((prev) =>
              prev
                ? {
                    ...prev,
                    pendingSuppliers: (prev.pendingSuppliers || []).filter((s: any) => s.id !== target.id),
                  }
                : prev
            );
          } else {
            patchApprovals((prev) =>
              prev
                ? {
                    ...prev,
                    newProductRequests: (prev.newProductRequests || []).filter(
                      (r: any) => r.id !== target.id
                    ),
                    productUpdateRequests: (prev.productUpdateRequests || []).filter(
                      (r: any) => r.id !== target.id
                    ),
                  }
                : prev
            );
          }
          setRejectionTarget(null);
          setRejectionReason('');
          notifyApprovalsChanged();
          toast.success('Request rejected');
        },
        onError: (msg) => {
          setActionError(msg);
          toast.error(msg);
        },
      }
    );
  }

  const suppliers = data?.pendingSuppliers || [];
  const newProducts = data?.newProductRequests || [];
  const updates = data?.productUpdateRequests || [];

  const tabs: { id: Tab; label: string; count: number; icon: typeof Building2 }[] = [
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length, icon: Building2 },
    { id: 'new', label: 'New products', count: newProducts.length, icon: Package },
    { id: 'updates', label: 'Product updates', count: updates.length, icon: CheckSquare },
  ];

  function renderEmpty(title: string, body: string, Icon: typeof Package) {
    return (
      <div className="saas-panel p-16 text-center space-y-2">
        <Icon className="w-10 h-10 text-portal-muted mx-auto" />
        <h3 className="type-empty-title">{title}</h3>
        <p className="type-empty-body">{body}</p>
      </div>
    );
  }

  function productCard(req: any) {
    const proposed = req.proposed_data || {};
    const liveProd = req.product;
    return (
      <div key={req.id} className="saas-panel p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="saas-badge-neutral">
              {req.request_type === 'update' ? 'Update pending' : 'Pending'}
            </span>
            <h3 className="text-base text-portal-text">{proposed.name || liveProd?.name}</h3>
          </div>
          <div className="text-xs text-portal-muted space-y-1.5 saas-inset-surface p-3">
            <div>
              Supplier: <b className="text-portal-text font-medium">{liveProd?.supplier?.company_name || 'Supplier'}</b>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <div>
                Proposed price: <span className="type-metric">₹{proposed.supplier_price}</span>
              </div>
              {proposed.moq && (
                <div>
                  MOQ: <b className="text-portal-text">{proposed.moq} units</b>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 flex-wrap">
          {liveProd?.id && (
            <button
              type="button"
              onClick={() => openReviewPanel(liveProd.id)}
              className="saas-btn-secondary flex-1 lg:flex-initial gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              Review
            </button>
          )}
          <button
            onClick={() => handleApproveProduct(req.id)}
            disabled={isPending(mutationKey(req.id, 'approve-product'))}
            className="saas-btn-primary flex-1 lg:flex-initial gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={() => setRejectionTarget({ type: 'product', id: req.id, name: proposed.name || 'Product request' })}
            disabled={isPending(mutationKey(req.id, 'approve-product'))}
            className="saas-btn-secondary flex-1 lg:flex-initial text-portal-danger hover:bg-portal-danger-soft gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="Approval Center"
        description="Verify supplier applications and product submissions."
        actions={
          <button onClick={() => loadApprovals(true, { force: true })} className="saas-btn-secondary gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {actionError && (
        <div className="text-sm text-portal-danger bg-portal-danger-soft rounded-lg p-3">{actionError}</div>
      )}

      {loading && !data ? (
        <div className="space-y-4" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
      <div className="saas-segmented overflow-x-auto flex-nowrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 gap-2 inline-flex items-center ${active ? 'saas-tab-active' : 'saas-tab-inactive'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-md text-xs font-mono tabular-nums ${
                  active
                    ? 'bg-portal-hero-text/15 text-portal-hero-text'
                    : 'bg-portal-inset text-portal-muted'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'suppliers' &&
        (suppliers.length === 0
          ? renderEmpty('No supplier applications pending', 'All registrations have been reviewed.', CheckSquare)
          : (
            <div className="grid grid-cols-1 gap-4">
              {suppliers.map((sup: any) => (
                <div key={sup.id} className="saas-panel p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <StatusPill label="Pending approval" tone="warning" />
                      <h3 className="text-base text-portal-text">{sup.company_name}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-portal-muted">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        <span>Contact: <b className="text-portal-text font-medium">{sup.contact_person}</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{sup.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{sup.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{sup.country}</span>
                      </div>
                    </div>
                    {sup.address && (
                      <div className="text-xs text-portal-muted saas-inset-surface p-3">Facility: {sup.address}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
                    <button
                      onClick={() => handleApproveSupplier(sup.id)}
                      disabled={isPending(mutationKey(sup.id, 'approve-supplier'))}
                      className="saas-btn-primary flex-1 lg:flex-initial gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectionTarget({ type: 'supplier', id: sup.id, name: sup.company_name })}
                      disabled={isPending(mutationKey(sup.id, 'reject'))}
                      className="saas-btn-secondary flex-1 lg:flex-initial text-portal-danger hover:bg-portal-danger-soft gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

      {activeTab === 'new' &&
        (newProducts.length === 0
          ? renderEmpty('No new product submissions', 'Catalog proposals will appear here.', Package)
          : <div className="grid grid-cols-1 gap-4">{newProducts.map(productCard)}</div>)}

      {activeTab === 'updates' &&
        (updates.length === 0
          ? renderEmpty('No product updates pending', 'Price and spec changes will appear here.', Package)
          : <div className="grid grid-cols-1 gap-4">{updates.map(productCard)}</div>)}
        </>
      )}

      <PortalModal
        open={!!rejectionTarget}
        onClose={() => {
          setRejectionTarget(null);
          setRejectionReason('');
        }}
        title={
          rejectionTarget
            ? `Reject ${rejectionTarget.type === 'supplier' ? 'supplier application' : 'product proposal'}`
            : undefined
        }
        footer={
          <>
            <button
              onClick={() => {
                setRejectionTarget(null);
                setRejectionReason('');
              }}
              className="saas-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={isPending(mutationKey(rejectionTarget?.id || '', 'reject')) || !rejectionReason.trim()}
              className="saas-btn-primary"
            >
              {isPending(mutationKey(rejectionTarget?.id || '', 'reject')) ? 'Processing…' : 'Confirm rejection'}
            </button>
          </>
        }
      >
        {rejectionTarget && (
          <>
            <p className="text-sm text-portal-muted mb-3">
              Provide feedback for <span className="font-medium text-portal-text">{rejectionTarget.name}</span>.
            </p>
            <textarea
              rows={4}
              required
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="saas-input resize-none w-full"
            />
          </>
        )}
      </PortalModal>

      <ProductFormPanel
        open={panelOpen}
        mode={panelMode}
        product={panelProduct}
        categories={categories}
        suppliers={supplierOptions}
        defaultGstRate={defaultGstRate}
        detailLoading={detailLoading}
        onClose={closeReviewPanel}
        onSuccess={() => {
          loadApprovals(true, { force: true });
          notifyApprovalsChanged();
          invalidateProductPortalCaches();
        }}
        onApprove={
          panelProduct
            ? () => {
                const requestId = panelProduct.pendingRequest?.id;
                if (requestId) void handleApproveProduct(requestId);
              }
            : undefined
        }
        isPending={isPending}
        mutationKey={mutationKey}
      />
    </div>
  );
}
