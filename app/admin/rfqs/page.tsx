'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Check,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  MapPin,
  MessageSquare,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { apiPost } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyDashboardChanged } from '@/components/portal/ApprovalsCountContext';
import { SalesWorkflowBar, ContactGrid } from '@/components/admin/SalesWorkflow';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';
import AdminSplitView from '@/components/admin/AdminSplitView';
import {
  rfqContact,
  rfqStatusBadgeClass,
  formatStatusLabel,
} from '@/lib/admin/sales-workflow';

const RFQ_STATUS_TABS = ['all', 'submitted', 'under_review', 'accepted', 'rejected', 'converted_to_order'] as const;

export default function AdminRfqsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [negotiatedPrices, setNegotiatedPrices] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [page, setPage] = useState(1);
  const [convertSuccess, setConvertSuccess] = useState('');

  const loadRfqs = useCallback(async (showLoading = true) => {
    const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
    const url = `/api/rfqs?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}${statusParam}`;
    const existing = peekPortalCache<{ rfqs: any[]; total: number }>(url);
    if (existing) {
      const list = existing.data.rfqs || [];
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
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await cachedApiGet<{ rfqs: any[]; total: number }>(url, {
        force: showLoading && !existing,
      });
      if (result.ok) {
        const list = result.data.rfqs || [];
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
        markPortalContentReady('/admin/rfqs');
      }
    } catch (err) {
      console.error('Failed to load RFQs:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page, statusFilter]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  function initNegotiationPrices(rfq: any) {
    const map: Record<string, number> = {};
    if (rfq?.items) {
      for (const itm of rfq.items) {
        map[itm.id] = itm.final_unit_price ?? itm.original_unit_price;
      }
    }
    setNegotiatedPrices(map);
    setShowReject(false);
    setRejectReason('');
    setActionError(null);
    setConvertSuccess('');
  }

  function handleSelectRfq(rfq: any) {
    setSelectedRfq(rfq);
    initNegotiationPrices(rfq);
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
      finalQuantity: itm.final_quantity ?? itm.original_quantity,
    }));

    await run(
      () => apiPost(`/api/rfqs/${selectedRfq.id}/negotiate`, { items: itemsPayload }),
      {
        key: mutationKey(selectedRfq.id, 'negotiate'),
        onSuccess: () => {
          patchRfq(selectedRfq.id, { status: 'under_review' });
          notifyDashboardChanged();
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleAcceptRfq() {
    if (!selectedRfq) return;
    setActionError(null);
    await run(() => apiPost(`/api/rfqs/${selectedRfq.id}/accept`), {
      key: mutationKey(selectedRfq.id, 'accept'),
      onSuccess: () => {
        patchRfq(selectedRfq.id, { status: 'accepted' });
        notifyDashboardChanged();
      },
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
          notifyDashboardChanged();
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleConvertToOrder() {
    if (!selectedRfq) return;
    setActionError(null);
    setConvertSuccess('');
    await run(() => apiPost(`/api/rfqs/${selectedRfq.id}/convert-to-order`), {
      key: mutationKey(selectedRfq.id, 'convert'),
      onSuccess: (data) => {
        patchRfq(selectedRfq.id, { status: 'converted_to_order' });
        setConvertSuccess((data as { orderNumber?: string })?.orderNumber || 'Order created');
        notifyDashboardChanged();
      },
      onError: (msg) => setActionError(msg),
    });
  }

  const rfqBusy = selectedRfq
    ? isPending(mutationKey(selectedRfq.id, 'negotiate')) ||
      isPending(mutationKey(selectedRfq.id, 'accept')) ||
      isPending(mutationKey(selectedRfq.id, 'reject')) ||
      isPending(mutationKey(selectedRfq.id, 'convert'))
    : false;

  const contact = selectedRfq ? rfqContact(selectedRfq) : null;

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="RFQs"
        description="Quotation requests — review products, negotiate pricing, accept, then convert to order."
        actions={
          <button onClick={() => loadRfqs()} className="saas-btn-secondary gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <SalesWorkflowBar active="rfqs" />

      <AdminToolbar>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center w-full">
          <div className="saas-search-field w-full sm:max-w-xs">
            <Search className="saas-search-icon" />
            <input
              type="text"
              placeholder="Search RFQ number or notes…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="saas-input w-full"
            />
          </div>
          <div className="saas-segmented overflow-x-auto flex-nowrap">
            {RFQ_STATUS_TABS.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 ${statusFilter === st ? 'saas-tab-active' : 'saas-tab-inactive'}`}
              >
                {formatStatusLabel(st)}
              </button>
            ))}
          </div>
        </div>
      </AdminToolbar>

      <AdminSplitView
        listCols={5}
        detailCols={7}
        list={
          rfqs.length === 0 ? (
            <div className="saas-panel p-10 text-center text-sm text-portal-muted">No RFQs found.</div>
          ) : (
            rfqs.map((r) => {
              const c = rfqContact(r);
              const isSelected = selectedRfq?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRfq(r)}
                  className={`saas-list-item space-y-1.5 ${isSelected ? 'saas-list-item-selected' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-id">{r.rfq_number}</span>
                    <span className={rfqStatusBadgeClass(r.status)}>{formatStatusLabel(r.status)}</span>
                  </div>
                  <div className="text-sm font-medium text-portal-text truncate">{c.name}</div>
                  <div className="flex justify-between text-xs text-portal-muted font-mono pt-1 border-t border-portal-border">
                    <span>{r.items?.length || 0} items</span>
                    <span>₹{(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}</span>
                  </div>
                </button>
              );
            })
          )
        }
        detail={
          selectedRfq ? (
            <div className="saas-panel p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-portal-border pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="type-section type-id">{selectedRfq.rfq_number}</h2>
                    <span className={rfqStatusBadgeClass(selectedRfq.status)}>
                      {formatStatusLabel(selectedRfq.status)}
                    </span>
                  </div>
                  <p className="text-xs text-portal-muted mt-1">
                    Submitted {new Date(selectedRfq.created_at).toLocaleDateString()}
                    {selectedRfq.enquiry_id && (
                      <>
                        {' · '}
                        <Link href="/admin/enquiries" className="underline">
                          From enquiry
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRfq.status === 'accepted' && (
                    <button
                      onClick={handleConvertToOrder}
                      disabled={rfqBusy}
                      className="saas-btn-gold text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Convert to order
                    </button>
                  )}
                  {(selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review') && (
                    <>
                      <button onClick={handleSaveNegotiation} disabled={rfqBusy} className="saas-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        Save prices
                      </button>
                      <button onClick={handleAcceptRfq} disabled={rfqBusy} className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </button>
                      <button onClick={() => setShowReject((v) => !v)} disabled={rfqBusy} className="saas-btn-secondary text-xs py-2 px-3 text-portal-danger flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>

              {contact && (
                <ContactGrid
                  name={contact.name}
                  email={contact.email}
                  phone={contact.phone}
                  country={contact.country}
                  company={contact.company}
                />
              )}

              {actionError && <p className="text-xs text-portal-danger bg-portal-danger-soft p-2 rounded-lg">{actionError}</p>}
              {convertSuccess && (
                <p className="text-xs text-portal-success">
                  {convertSuccess} —{' '}
                  <Link href="/admin/orders" className="underline inline-flex items-center gap-1">
                    View orders <ArrowRight className="w-3 h-3" />
                  </Link>
                </p>
              )}

              {showReject && (selectedRfq.status === 'submitted' || selectedRfq.status === 'under_review') && (
                <div className="space-y-2 p-3 rounded-xl bg-portal-danger-soft border border-portal-danger/30">
                  <label className="type-meta text-portal-danger">Rejection reason</label>
                  <textarea className="saas-input text-xs min-h-[72px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <button type="button" onClick={handleRejectRfq} disabled={rfqBusy} className="saas-btn-primary text-xs py-1.5 px-3 bg-rose-700">
                    Confirm reject
                  </button>
                </div>
              )}

              {selectedRfq.status === 'rejected' && selectedRfq.rejection_reason && (
                <p className="text-xs text-portal-danger bg-portal-danger-soft p-3 rounded-xl">Rejected: {selectedRfq.rejection_reason}</p>
              )}

              <div className="saas-table-container">
                <table className="saas-table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Listed</th>
                      <th>Negotiated unit</th>
                      <th className="text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRfq.items?.map((item: any) => {
                      const negotiatedPrice = negotiatedPrices[item.id] ?? (item.final_unit_price ?? item.original_unit_price);
                      const qty = item.final_quantity ?? item.original_quantity;
                      const lineTotal = qty * negotiatedPrice;
                      const locked = selectedRfq.status === 'converted_to_order' || selectedRfq.status === 'rejected';

                      return (
                        <tr key={item.id}>
                          <td className="font-medium">{item.product_name_snapshot}</td>
                          <td className="type-metric">{qty}</td>
                          <td className="type-metric text-portal-muted">₹{item.original_unit_price?.toLocaleString('en-IN')}</td>
                          <td>
                            {locked ? (
                              <span className="type-metric">₹{negotiatedPrice?.toLocaleString('en-IN')}</span>
                            ) : (
                              <input
                                type="number"
                                value={negotiatedPrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setNegotiatedPrices((prev) => ({ ...prev, [item.id]: val }));
                                }}
                                className="saas-input type-metric w-28 py-1 px-2 text-xs"
                              />
                            )}
                          </td>
                          <td className="type-metric text-right">₹{lineTotal.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-portal-inset p-3 rounded-xl">
                <div>
                  <div className="type-meta text-portal-muted flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3" /> Delivery address
                  </div>
                  <div className="text-portal-text leading-relaxed">
                    {selectedRfq.delivery_address_snapshot?.address_line_1}<br />
                    {selectedRfq.delivery_address_snapshot?.city}, {selectedRfq.delivery_address_snapshot?.state}{' '}
                    {selectedRfq.delivery_address_snapshot?.postal_code}<br />
                    {selectedRfq.delivery_address_snapshot?.country}
                  </div>
                </div>
                <div>
                  <div className="type-meta text-portal-muted flex items-center gap-1 mb-1">
                    <MessageSquare className="w-3 h-3" /> Notes
                  </div>
                  <div className="text-portal-muted">{selectedRfq.customer_message || '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-sm text-portal-muted">
              Select an RFQ to negotiate pricing and manage status.
            </div>
          )
        }
      />
    </div>
  );
}
