'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Calendar,
  Check,
  MessageSquare,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { SUPPLIER_PORTAL_LIST_LIMIT } from '@/lib/client/portal-nav-prefetch';

export default function SupplierRfqsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<any>(null);

  const [negotiatedQtys, setNegotiatedQtys] = useState<Record<string, number>>({});
  const { isPending, run } = useMutation();
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function initNegotiationQtys(rfq: any) {
    const map: Record<string, number> = {};
    if (rfq?.items) {
      for (const itm of rfq.items) {
        map[itm.id] = itm.final_quantity ?? itm.original_quantity;
      }
    }
    setNegotiatedQtys(map);
  }

  async function loadRfqDetail(rfqId: string) {
    setDetailLoading(true);
    try {
      const json = await apiGet<{ rfq: any }>(`/api/supplier/rfqs/${rfqId}`);
      if (json.ok && json.data?.rfq) {
        setSelectedRfq(json.data.rfq);
        initNegotiationQtys(json.data.rfq);
      }
    } catch (err) {
      console.error('Failed to load RFQ detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadRfqs(selectId?: string | null) {
    setLoading(true);
    try {
      const url = `/api/supplier/rfqs?page=${page}&limit=${SUPPLIER_PORTAL_LIST_LIMIT}&search=${encodeURIComponent(debouncedSearch)}`;
      const json = await apiGet<{ rfqs: any[]; total: number }>(url);
      if (json.ok) {
        const list = json.data.rfqs || [];
        setRfqs(list);
        setTotal(json.data.total || 0);

        const targetId = selectId ?? selectedRfqId;
        const stillVisible = targetId && list.some((r: any) => r.id === targetId);
        if (stillVisible && targetId) {
          setSelectedRfqId(targetId);
          await loadRfqDetail(targetId);
        } else if (list[0]) {
          setSelectedRfqId(list[0].id);
          await loadRfqDetail(list[0].id);
        } else {
          setSelectedRfqId(null);
          setSelectedRfq(null);
        }
      }
    } catch (err) {
      console.error('Failed to load supplier RFQs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  async function handleSelectRfq(rfq: any) {
    setSelectedRfqId(rfq.id);
    setActionError('');
    setActionSuccess('');
    await loadRfqDetail(rfq.id);
  }

  function patchRfq(rfqId: string, patch: Record<string, unknown>) {
    setRfqs((prev) => prev.map((r) => (r.id === rfqId ? { ...r, ...patch } : r)));
    setSelectedRfq((prev: any) => (prev?.id === rfqId ? { ...prev, ...patch } : prev));
  }

  async function handleNegotiate() {
    if (!selectedRfq) return;
    setActionError('');
    setActionSuccess('');
    const itemsPayload = (selectedRfq.items || []).map((itm: any) => ({
      rfqItemId: itm.id,
      finalQuantity: negotiatedQtys[itm.id] ?? itm.original_quantity,
    }));
    await run(
      () => apiPost(`/api/rfqs/${selectedRfq.id}/negotiate`, { items: itemsPayload }),
      {
        key: mutationKey(selectedRfq.id, 'negotiate'),
        onSuccess: () => {
          setActionSuccess('Negotiation saved. Quantities updated.');
          patchRfq(selectedRfq.id, { status: 'under_review' });
          void loadRfqDetail(selectedRfq.id);
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  const rfqBusy = selectedRfq
    ? isPending(mutationKey(selectedRfq.id, 'negotiate'))
    : false;

  const canAct =
    selectedRfq &&
    (selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review');

  const totalPages = Math.max(1, Math.ceil(total / SUPPLIER_PORTAL_LIST_LIMIT));

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Volume RFQs</h1>
          <p className="type-subtitle">
            Quotation requests matching your listed products.
          </p>
        </div>

        <button
          onClick={() => loadRfqs()}
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh RFQs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3">
          <div className="saas-panel p-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search RFQs by number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="saas-input pl-8 text-xs"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-portal-muted" />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {loading ? (
              <div className="saas-panel p-12 text-center text-xs text-portal-muted">
                Loading RFQs…
              </div>
            ) : rfqs.length === 0 ? (
              <div className="saas-panel p-12 text-center text-xs text-portal-muted">
                No matching volume quotation requests found.
              </div>
            ) : (
              rfqs.map((r) => {
                const isSelected = selectedRfqId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRfq(r)}
                    className={`saas-panel p-4 cursor-pointer transition-all space-y-2 ${
                      isSelected ? 'ring-2 ring-amber-500 shadow-md' : 'hover:bg-portal-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="type-id text-portal-text">{r.rfq_number}</span>
                      <span
                        className={
                          r.status === 'accepted'
                            ? 'saas-badge-success'
                            : r.status === 'converted_to_order'
                              ? 'saas-badge-cyan'
                              : r.status === 'rejected'
                                ? 'saas-badge-danger'
                                : 'saas-badge-gold'
                        }
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-portal-muted">
                      Demand lines for your products
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-portal-border">
                      <span className="text-portal-muted">{r.item_count || 0} product line(s)</span>
                      <span className="text-portal-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-portal-muted" />
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {total > SUPPLIER_PORTAL_LIST_LIMIT && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="saas-btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-xs text-portal-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="saas-btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          {detailLoading ? (
            <div className="saas-panel p-16 text-center text-xs text-portal-muted">
              Loading RFQ details…
            </div>
          ) : selectedRfq ? (
            <div className="saas-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-portal-border pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="type-section type-id">{selectedRfq.rfq_number}</h2>
                    <span className="saas-badge-gold">{selectedRfq.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-portal-muted mt-1">
                    Submitted {new Date(selectedRfq.created_at).toLocaleDateString()}
                  </div>
                </div>

                {canAct && (
                  <div className="flex flex-wrap gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleNegotiate}
                      disabled={rfqBusy}
                      className="saas-btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-portal-text" />
                      <span>{rfqBusy ? 'Working…' : 'Negotiate quantities'}</span>
                    </button>
                    <p className="w-full text-[11px] text-portal-muted">
                      Accept / reject is handled by MITFAST admin after negotiation.
                    </p>
                  </div>
                )}
              </div>

              {actionSuccess && (
                <div className="p-3 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-portal-success shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-portal-danger shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {selectedRfq.status === 'rejected' && selectedRfq.rejection_reason && (
                <p className="text-xs text-portal-danger bg-portal-danger-soft p-3 rounded-xl">
                  Rejected: {selectedRfq.rejection_reason}
                </p>
              )}

              <div className="space-y-2">
                <div className="type-section text-portal-muted">
                  Your products in this quotation request
                </div>

                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Requested qty</th>
                        {canAct && <th className="text-right">Negotiate qty</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRfq.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="font-medium text-portal-text text-xs">
                            {item.product_name_snapshot}
                          </td>
                          <td className="text-right text-portal-text type-metric">
                            {item.original_quantity} Units
                          </td>
                          {canAct && (
                            <td className="text-right">
                              <input
                                type="number"
                                min={1}
                                value={negotiatedQtys[item.id] ?? item.original_quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setNegotiatedQtys((prev) => ({
                                    ...prev,
                                    [item.id]: Number.isFinite(val) && val >= 1 ? val : 1,
                                  }));
                                }}
                                className="saas-input text-xs type-metric w-24 ml-auto text-right"
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-portal-muted">
                Buyer identity, destination address, and selling prices are withheld. Fulfill from product demand only.
                {canAct ? ' Use Negotiate to propose quantity changes; MITFAST admin accepts or rejects.' : ''}
              </p>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-portal-muted">
              Select an RFQ from the list to view product line items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
