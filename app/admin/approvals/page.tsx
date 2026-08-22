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
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';

type Tab = 'suppliers' | 'new' | 'updates';

export default function AdminApprovalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('suppliers');
  const [rejectionTarget, setRejectionTarget] = useState<{ type: 'supplier' | 'product'; id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();

  const loadApprovals = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{
        pendingSuppliers: any[];
        newProductRequests: any[];
        productUpdateRequests: any[];
      }>('/api/admin/approvals');
      if (result.ok) setData(result.data);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  async function handleApproveSupplier(supplierId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/suppliers/${supplierId}/approve`), {
      key: mutationKey(supplierId, 'approve-supplier'),
      onSuccess: () => {
        setData((prev: any) => ({
          ...prev,
          pendingSuppliers: (prev?.pendingSuppliers || []).filter((s: any) => s.id !== supplierId),
        }));
        notifyApprovalsChanged();
      },
      onError: (msg) => setActionError(msg),
    });
  }

  async function handleApproveProduct(requestId: string) {
    setActionError(null);
    await run(() => apiPost(`/api/products/requests/${requestId}/approve`), {
      key: mutationKey(requestId, 'approve-product'),
      onSuccess: () => {
        setData((prev: any) => ({
          ...prev,
          newProductRequests: (prev?.newProductRequests || []).filter((r: any) => r.id !== requestId),
          productUpdateRequests: (prev?.productUpdateRequests || []).filter((r: any) => r.id !== requestId),
        }));
        notifyApprovalsChanged();
      },
      onError: (msg) => setActionError(msg),
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
            setData((prev: any) => ({
              ...prev,
              pendingSuppliers: (prev?.pendingSuppliers || []).filter((s: any) => s.id !== target.id),
            }));
          } else {
            setData((prev: any) => ({
              ...prev,
              newProductRequests: (prev?.newProductRequests || []).filter((r: any) => r.id !== target.id),
              productUpdateRequests: (prev?.productUpdateRequests || []).filter((r: any) => r.id !== target.id),
            }));
          }
          setRejectionTarget(null);
          setRejectionReason('');
          notifyApprovalsChanged();
        },
        onError: (msg) => setActionError(msg),
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
        <Icon className="w-10 h-10 text-[#6B7280] mx-auto" />
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
            <h3 className="text-base text-[#111315]">{proposed.name || liveProd?.name}</h3>
          </div>
          <div className="text-xs text-[#6B7280] space-y-1.5 saas-inset-surface p-3">
            <div>
              Supplier: <b className="text-[#111315] font-medium">{liveProd?.supplier?.company_name || 'Supplier'}</b>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <div>
                Proposed price: <span className="type-metric">₹{proposed.supplier_price}</span>
              </div>
              {proposed.moq && (
                <div>
                  MOQ: <b className="text-[#111315]">{proposed.moq} units</b>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
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
            className="saas-btn-secondary flex-1 lg:flex-initial text-[#B91C1C] hover:bg-[#FEF2F2] gap-1.5"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Approval Center</h1>
          <p className="type-subtitle">Verify supplier applications and product submissions.</p>
        </div>
        <button onClick={() => loadApprovals()} className="saas-neu-button gap-2 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] rounded-lg p-2.5">{actionError}</div>
      )}

      <div className="saas-segmented flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={active ? 'saas-tab-active gap-2 inline-flex items-center' : 'saas-tab-inactive gap-2 inline-flex items-center'}>
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${active ? 'bg-white text-[#111315]' : 'bg-[#111315] text-white'}`}>
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
                      <span className="badge-warning">Pending approval</span>
                      <h3 className="text-base text-[#111315]">{sup.company_name}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        <span>Contact: <b className="text-[#111315] font-medium">{sup.contact_person}</b></span>
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
                      <div className="text-xs text-[#6B7280] saas-inset-surface p-3">Facility: {sup.address}</div>
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
                      className="saas-btn-secondary flex-1 lg:flex-initial text-[#B91C1C] hover:bg-[#FEF2F2] gap-1.5"
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

      {rejectionTarget && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 saas-panel space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <h3 className="text-base text-[#111315]">
                Reject {rejectionTarget.type === 'supplier' ? 'supplier application' : 'product proposal'}
              </h3>
              <button
                onClick={() => {
                  setRejectionTarget(null);
                  setRejectionReason('');
                }}
                className="saas-btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6B7280]">
              Provide feedback for <span className="font-medium text-[#111315]">{rejectionTarget.name}</span>.
            </p>
            <textarea
              rows={4}
              required
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="saas-input resize-none rounded-xl"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4E8]">
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
                disabled={isPending(mutationKey(rejectionTarget.id, 'reject')) || !rejectionReason.trim()}
                className="saas-btn-primary bg-[#B91C1C] hover:bg-[#991B1B]"
              >
                {isPending(mutationKey(rejectionTarget.id, 'reject')) ? 'Processing…' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
