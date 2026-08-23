'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  Calendar,
  Check,
  XCircle,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';

export default function SupplierRfqsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRfq, setSelectedRfq] = useState<any>(null);

  const [negotiatedQtys, setNegotiatedQtys] = useState<Record<string, number>>({});
  const { isPending, run } = useMutation();
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  function initNegotiationQtys(rfq: any) {
    const map: Record<string, number> = {};
    if (rfq?.items) {
      for (const itm of rfq.items) {
        map[itm.id] = itm.final_quantity ?? itm.original_quantity;
      }
    }
    setNegotiatedQtys(map);
  }

  async function loadRfqs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/rfqs?search=${encodeURIComponent(searchTerm)}`);
      const json = await res.json();
      if (json.success) {
        const list = json.data.rfqs || [];
        setRfqs(list);
        setSelectedRfq((prev: any) => {
          if (prev) {
            const updated = list.find((r: any) => r.id === prev.id);
            if (updated) {
              initNegotiationQtys(updated);
              return updated;
            }
          }
          if (list[0]) {
            initNegotiationQtys(list[0]);
            return list[0];
          }
          return null;
        });
      }
    } catch (err) {
      console.error('Failed to load supplier RFQs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRfqs();
  }, [searchTerm]);

  function handleSelectRfq(rfq: any) {
    setSelectedRfq(rfq);
    initNegotiationQtys(rfq);
    setShowReject(false);
    setRejectReason('');
    setActionError('');
    setActionSuccess('');
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
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleAccept() {
    if (!selectedRfq) return;
    setActionError('');
    setActionSuccess('');
    await run(() => apiPost(`/api/rfqs/${selectedRfq.id}/accept`), {
      key: mutationKey(selectedRfq.id, 'accept'),
      onSuccess: () => {
        setActionSuccess('RFQ accepted.');
        patchRfq(selectedRfq.id, { status: 'accepted' });
      },
      onError: (msg) => setActionError(msg),
    });
  }

  async function handleReject() {
    if (!selectedRfq) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setActionError('A rejection reason is required (at least 3 characters).');
      return;
    }
    setActionError('');
    setActionSuccess('');
    await run(
      () => apiPost(`/api/rfqs/${selectedRfq.id}/reject`, { rejectionReason: reason }),
      {
        key: mutationKey(selectedRfq.id, 'reject'),
        onSuccess: () => {
          setShowReject(false);
          setRejectReason('');
          setActionSuccess('RFQ rejected.');
          patchRfq(selectedRfq.id, { status: 'rejected' });
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  const rfqBusy = selectedRfq
    ? isPending(mutationKey(selectedRfq.id, 'negotiate')) ||
      isPending(mutationKey(selectedRfq.id, 'accept')) ||
      isPending(mutationKey(selectedRfq.id, 'reject'))
    : false;

  const canAct =
    selectedRfq &&
    (selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review');

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Volume RFQs
          </h1>
          <p className="type-subtitle">
            Quotation requests matching your manufactured precision engineering components.
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
        {/* RFQ List (5 cols) */}
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
                const isSelected = selectedRfq?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRfq(r)}
                    className={`saas-panel p-4 cursor-pointer transition-all space-y-2 ${
                      isSelected 
                        ? 'ring-2 ring-amber-500 shadow-md' 
                        : 'hover:bg-portal-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="type-id text-portal-text">{r.rfq_number}</span>
                      <span className={
                        r.status === 'accepted' 
                          ? 'saas-badge-success' 
                          : r.status === 'converted_to_order' 
                          ? 'saas-badge-cyan' 
                          : r.status === 'rejected'
                          ? 'saas-badge-danger'
                          : 'saas-badge-gold'
                      }>
                        {r.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-portal-muted">
                      Demand lines for your SKUs
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-portal-border">
                      <span className="text-portal-muted">{r.items?.length || 0} component line(s)</span>
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
        </div>

        {/* Selected RFQ Detail (7 cols) */}
        <div className="lg:col-span-7">
          {selectedRfq ? (
            <div className="saas-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-portal-border pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="type-section type-id">
                      {selectedRfq.rfq_number}
                    </h2>
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
                      <span>{rfqBusy ? 'Working…' : 'Negotiate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={rfqBusy}
                      className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReject((v) => !v);
                        setActionError('');
                      }}
                      disabled={rfqBusy}
                      className="saas-btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-portal-danger"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
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

              {showReject && canAct && (
                <div className="space-y-2 p-3 rounded-xl bg-portal-danger-soft border border-portal-danger/30">
                  <label className="type-meta text-portal-danger">Rejection reason (required)</label>
                  <textarea
                    className="saas-input text-xs min-h-[72px]"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why you cannot fulfill this RFQ"
                  />
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={rfqBusy}
                    className="saas-btn-primary text-xs py-1.5 px-3 bg-rose-700"
                  >
                    Confirm reject
                  </button>
                </div>
              )}

              {selectedRfq.status === 'rejected' && selectedRfq.rejection_reason && (
                <p className="text-xs text-portal-danger bg-portal-danger-soft p-3 rounded-xl">
                  Rejected: {selectedRfq.rejection_reason}
                </p>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <div className="type-section text-portal-muted">
                  Your Components in this Quotation Request
                </div>

                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th className="text-right">Requested qty</th>
                        {canAct && <th className="text-right">Negotiate qty</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRfq.items?.map((item: any) => {
                        return (
                          <tr key={item.id}>
                            <td className="font-medium text-portal-text text-xs">
                              {item.product_name_snapshot}
                              {item.sku ? <span className="block text-portal-muted font-normal">SKU {item.sku}</span> : null}
                            </td>
                            <td className="text-right text-portal-text type-metric">{item.original_quantity} Units</td>
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-portal-muted">
                Buyer identity, destination address, and selling prices are withheld. Fulfill from SKU demand only.
                {canAct ? ' Use Negotiate to propose quantity changes, then Accept or Reject.' : ''}
              </p>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-portal-muted">
              Select an RFQ from the list to view component line items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
