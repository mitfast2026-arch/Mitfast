'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Check, 
  RefreshCw, 
  ShoppingCart, 
  DollarSign, 
  MapPin, 
  MessageSquare,
  XCircle,
  Loader2,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';

export default function AdminRfqsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRfq, setSelectedRfq] = useState<any>(null);

  // Negotiation state
  const [negotiatedPrices, setNegotiatedPrices] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadRfqs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{ rfqs: any[]; total: number }>(
        `/api/rfqs?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=50`
      );
      if (result.ok) {
        const list = result.data.rfqs || [];
        setTotal(result.data.total || list.length);
        setRfqs(list);
        setSelectedRfq((prev: any) => {
          if (prev) {
            const updated = list.find((r: any) => r.id === prev.id);
            if (updated) {
              initNegotiationPrices(updated);
              return updated;
            }
          }
          if (list[0]) {
            initNegotiationPrices(list[0]);
            return list[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to load RFQs:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [searchTerm, page]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  function initNegotiationPrices(rfq: any) {
    const map: Record<string, number> = {};
    if (rfq && rfq.items) {
      for (const itm of rfq.items) {
        map[itm.id] = itm.final_unit_price ?? itm.original_unit_price;
      }
    }
    setNegotiatedPrices(map);
  }

  function handleSelectRfq(rfq: any) {
    setSelectedRfq(rfq);
    initNegotiationPrices(rfq);
    setShowReject(false);
    setRejectReason('');
  }

  function patchRfq(rfqId: string, patch: Record<string, unknown>) {
    setRfqs((prev) => prev.map((r) => (r.id === rfqId ? { ...r, ...patch } : r)));
    setSelectedRfq((prev: any) => (prev?.id === rfqId ? { ...prev, ...patch } : prev));
  }

  async function handleSaveNegotiation() {
    if (!selectedRfq) return;
    setActionError(null);
    const itemsPayload = selectedRfq.items.map((itm: any) => ({
      rfqItemId: itm.id,
      finalUnitPrice: negotiatedPrices[itm.id] ?? itm.original_unit_price,
      finalQuantity: itm.original_quantity,
    }));

    await run(
      () =>
        apiPost(`/api/rfqs/${selectedRfq.id}/negotiate`, { items: itemsPayload }),
      {
        key: mutationKey(selectedRfq.id, 'negotiate'),
        onSuccess: () => patchRfq(selectedRfq.id, { status: 'under_review' }),
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleAcceptRfq() {
    if (!selectedRfq) return;
    setActionError(null);
    await run(() => apiPost(`/api/rfqs/${selectedRfq.id}/accept`), {
      key: mutationKey(selectedRfq.id, 'accept'),
      onSuccess: () => patchRfq(selectedRfq.id, { status: 'accepted' }),
      onError: (msg) => setActionError(msg),
    });
  }

  async function handleRejectRfq() {
    if (!selectedRfq) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setActionError('A rejection reason is required (at least 3 characters).');
      return;
    }
    setActionError(null);
    await run(
      () => apiPost(`/api/rfqs/${selectedRfq.id}/reject`, { rejectionReason: reason }),
      {
        key: mutationKey(selectedRfq.id, 'reject'),
        onSuccess: () => {
          patchRfq(selectedRfq.id, { status: 'rejected' });
          setShowReject(false);
          setRejectReason('');
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleConvertToOrder() {
    if (!selectedRfq) return;
    setActionError(null);
    await run(() => apiPost(`/api/rfqs/${selectedRfq.id}/convert-to-order`), {
      key: mutationKey(selectedRfq.id, 'convert'),
      onSuccess: () => patchRfq(selectedRfq.id, { status: 'converted' }),
      onError: (msg) => setActionError(msg),
    });
  }

  const rfqBusy = selectedRfq
    ? isPending(mutationKey(selectedRfq.id, 'negotiate')) ||
      isPending(mutationKey(selectedRfq.id, 'accept')) ||
      isPending(mutationKey(selectedRfq.id, 'reject')) ||
      isPending(mutationKey(selectedRfq.id, 'convert'))
    : false;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Volume RFQs
          </h1>
          <p className="type-subtitle">
            Review bulk quotation requests, set negotiated pricing margins, and convert accepted quotes to official orders.
          </p>
        </div>

        <button 
          onClick={() => loadRfqs()} 
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh RFQs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RFQ List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="saas-panel p-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search by RFQ number or buyer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="saas-input pl-8 text-xs"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {rfqs.length === 0 ? (
              <div className="saas-panel p-12 text-center text-xs text-[#6B7280]">
                No quotation requests found.
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
                        : 'hover:bg-[#F7F7F8]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="type-id text-xs text-[#111315]">{r.rfq_number}</span>
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

                    <div className="text-xs text-[#6B7280]">
                      Buyer: <span className="text-[#111315] font-medium">{r.customer?.full_name || 'Procurement Buyer'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E4E8]">
                      <span className="text-[#6B7280]">{r.items?.length || 0} line items</span>
                      <span className="type-metric text-[#111315]">
                        ₹{(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected RFQ Detail & Price Negotiation Matrix (8 cols) */}
        <div className="lg:col-span-8">
          {selectedRfq ? (
            <div className="saas-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E4E8] pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="type-section type-id">
                      {selectedRfq.rfq_number}
                    </h2>
                    <span className="saas-badge-gold">{selectedRfq.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-[#6B7280] mt-1">
                    Submitted {new Date(selectedRfq.created_at).toLocaleDateString()} • Buyer: <b className="text-[#111315]">{selectedRfq.customer?.full_name}</b>
                  </div>
                </div>

                <div className="flex gap-2 self-start sm:self-auto shrink-0">
                  {selectedRfq.status === 'accepted' && (
                    <button 
                      onClick={handleConvertToOrder}
                      disabled={rfqBusy}
                      className="saas-btn-gold text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Convert to Order</span>
                    </button>
                  )}
                  {(selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review') && (
                    <>
                      <button 
                        onClick={handleSaveNegotiation}
                        disabled={rfqBusy}
                        className="saas-btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-[#111315]" />
                        <span>Save Prices</span>
                      </button>
                      <button 
                        onClick={handleAcceptRfq}
                        disabled={rfqBusy}
                        className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Quote</span>
                      </button>
                      <button
                        onClick={() => setShowReject((v) => !v)}
                        disabled={rfqBusy}
                        className="saas-btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-[#B91C1C]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showReject && (selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review') && (
                <div className="space-y-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
                  <label className="type-meta text-[#B91C1C]">Rejection reason (required)</label>
                  <textarea
                    className="saas-input text-xs min-h-[72px]"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this RFQ is being rejected"
                  />
                  <button
                    type="button"
                    onClick={handleRejectRfq}
                    disabled={rfqBusy}
                    className="saas-btn-primary text-xs py-1.5 px-3 bg-rose-700"
                  >
                    Confirm reject
                  </button>
                </div>
              )}

              {selectedRfq.status === 'rejected' && selectedRfq.rejection_reason && (
                <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] p-3 rounded-xl">
                  Rejected: {selectedRfq.rejection_reason}
                </p>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <div className="type-section">
                  Line items & quotation pricing
                </div>

                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Quantity</th>
                        <th>Original price</th>
                        <th>Official quote unit</th>
                        <th className="text-right">LINE TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRfq.items?.map((item: any) => {
                        const originalPrice = item.original_unit_price;
                        const negotiatedPrice = negotiatedPrices[item.id] ?? (item.final_unit_price ?? originalPrice);
                        const lineTotal = item.original_quantity * negotiatedPrice;

                        return (
                          <tr key={item.id}>
                            <td className="font-medium text-[#111315] text-xs">
                              {item.product_name_snapshot}
                            </td>
                            <td className="type-metric text-[#111315]">{item.original_quantity} Units</td>
                            <td className="type-metric text-[#6B7280]">
                              ₹{originalPrice?.toLocaleString('en-IN')}
                            </td>
                            <td>
                              {selectedRfq.status === 'converted_to_order' ? (
                                <span className="type-metric text-[#111315]">₹{negotiatedPrice?.toLocaleString('en-IN')}</span>
                              ) : (
                                <input 
                                  type="number"
                                  value={negotiatedPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setNegotiatedPrices(prev => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="saas-input type-metric w-28 py-1 px-2 text-[#111315] text-xs"
                                />
                              )}
                            </td>
                            <td className="type-metric text-right text-[#111315]">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery address & buyer notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F7F7F8] p-4 rounded-xl">
                <div className="space-y-1">
                  <div className="type-meta text-[#6B7280] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#6B7280]" />
                    <span>Delivery destination</span>
                  </div>
                  <div className="text-[#111315] leading-relaxed font-medium">
                    {selectedRfq.delivery_address_snapshot?.address_line_1 || 'Standard Factory Delivery'}<br />
                    {selectedRfq.delivery_address_snapshot?.city}, {selectedRfq.delivery_address_snapshot?.state} - {selectedRfq.delivery_address_snapshot?.postal_code}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="type-meta text-[#6B7280] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-[#6B7280]" />
                    <span>Buyer notes</span>
                  </div>
                  <div className="text-[#6B7280] leading-relaxed">
                    {selectedRfq.customer_message || 'No additional commercial terms attached.'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-[#6B7280]">
              Select an RFQ from the list to view line items and negotiate prices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
