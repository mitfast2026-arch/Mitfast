'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, RefreshCw, MapPin, ArrowRight, Plus, ChevronLeft } from 'lucide-react';
import type { OrderStatus, PaymentStatus } from '@/types/database';
import { apiPut } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { toast } from 'sonner';
import { notifyDashboardChanged } from '@/components/portal/ApprovalsCountContext';
import { SalesWorkflowBar, ContactGrid } from '@/components/admin/SalesWorkflow';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';
import AdminSplitView from '@/components/admin/AdminSplitView';
import ManualOrderModal from '@/app/admin/orders/ManualOrderModal';
import {
  orderContact,
  orderStatusBadgeClass,
  formatStatusLabel,
} from '@/lib/admin/sales-workflow';
import { ORDER_STATUS_TRANSITIONS, allowedFrom } from '@/lib/server/db/conditional-update';

const ORDER_STATUS_TABS = ['all', 'accepted', 'packing', 'dispatched', 'cancelled'] as const;

function AdminOrdersPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const { isPending, run } = useMutation();

  const loadOrders = useCallback(async (showLoading = true, opts?: { force?: boolean }) => {
    const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
    const url = `/api/orders?page=${page}&limit=${PORTAL_PAGE_LIMIT}&search=${encodeURIComponent(debouncedSearch)}${statusParam}`;
    const force = Boolean(opts?.force);
    const existing = force ? null : peekPortalCache<{ orders: any[]; total: number }>(url);
    if (existing) {
      const list = existing.data.orders || [];
      setOrders(list);
      setTotal(existing.data.total || 0);
      setSelectedOrder((prev: any) => {
        if (prev) {
          const updated = list.find((o: any) => o.id === prev.id);
          return updated || prev;
        }
        return list[0] || null;
      });
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await cachedApiGet<{ orders: any[]; total: number }>(url, {
        force: force || (showLoading && !existing),
      });
      if (result.ok) {
        const list = result.data.orders || [];
        setOrders(list);
        setTotal(result.data.total || 0);
        setSelectedOrder((prev: any) => {
          if (prev) {
            const updated = list.find((o: any) => o.id === prev.id);
            return updated || prev;
          }
          return list[0] || null;
        });
        markPortalContentReady('/admin/orders');
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function patchOrder(orderId: string, patch: Record<string, unknown>) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
    setSelectedOrder((prev: any) => (prev?.id === orderId ? { ...prev, ...patch } : prev));
  }

  async function handleSaveOrderLines() {
    if (!selectedOrder) return;
    setActionError(null);
    toast.loading('Saving line items...', { id: 'order-lines' });
    await run(
      () =>
        apiPut(`/api/orders/${selectedOrder.id}`, {
          items: (selectedOrder.items || []).map((itm: any) => ({
            orderItemId: itm.id,
            productId: itm.product_id,
            quantity: Number(itm.quantity),
            unitPrice: Number(itm.unit_price),
            gstRate: itm.gst_rate ?? 0,
            gstIncluded: itm.gst_included ?? false,
            discount: itm.discount ?? 0,
          })),
        }),
      {
        key: mutationKey(selectedOrder.id, 'save-lines'),
        onSuccess: () => {
          toast.success('Order items updated', { id: 'order-lines' });
        },
        onError: (msg) => {
          setActionError(msg);
          toast.error(msg, { id: 'order-lines' });
        },
      }
    );
  }

  async function handleUpdateStatus(orderId: string, newStatus: OrderStatus) {
    setActionError(null);
    const currentOrder = orders.find((o) => o.id === orderId);
    const oldStatus = currentOrder?.status;
    if (oldStatus === newStatus) return;

    await run(
      () => apiPut(`/api/orders/${orderId}/status`, { status: newStatus }),
      {
        key: mutationKey(orderId, `status-${newStatus}`),
        optimistic: () => patchOrder(orderId, { status: newStatus }),
        rollback: () => oldStatus && patchOrder(orderId, { status: oldStatus }),
        onSuccess: () => {
          patchOrder(orderId, { status: newStatus });
          notifyDashboardChanged();
          toast.success(`Status updated to ${formatStatusLabel(newStatus)}`);
        },
        onError: (msg) => {
          setActionError(msg);
          toast.error(msg);
        },
      }
    );
  }

  async function handleUpdatePayment(orderId: string, newPaymentStatus: PaymentStatus) {
    setActionError(null);
    const currentOrder = orders.find((o) => o.id === orderId);
    const oldPayment = currentOrder?.payment_status;
    if (oldPayment === newPaymentStatus) return;

    await run(
      () => apiPut(`/api/orders/${orderId}/payment`, { paymentStatus: newPaymentStatus }),
      {
        key: mutationKey(orderId, `payment-${newPaymentStatus}`),
        optimistic: () => patchOrder(orderId, { payment_status: newPaymentStatus }),
        rollback: () => oldPayment && patchOrder(orderId, { payment_status: oldPayment }),
        onSuccess: () => {
          patchOrder(orderId, { payment_status: newPaymentStatus });
          toast.success(`Payment updated to ${formatStatusLabel(newPaymentStatus)}`);
        },
        onError: (msg) => {
          setActionError(msg);
          toast.error(msg);
        },
      }
    );
  }

  const orderBusy = selectedOrder
    ? isPending(mutationKey(selectedOrder.id, 'save-lines')) ||
      (['accepted', 'packing', 'dispatched', 'cancelled'] as OrderStatus[]).some((s) =>
        isPending(mutationKey(selectedOrder.id, `status-${s}`))
      )
    : false;

  const contact = selectedOrder ? orderContact(selectedOrder) : null;

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        title="Orders"
        description="Orders from accepted enquiries and RFQs — status, payment, and delivery."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setManualOrderOpen(true)}
              className="saas-btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              Manual order
            </button>
            <button onClick={() => loadOrders(true, { force: true })} className="saas-btn-secondary gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      <SalesWorkflowBar active="orders" />

      <AdminToolbar>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center w-full">
          <div className="saas-search-field w-full sm:max-w-xs">
            <Search className="saas-search-icon" />
            <input
              type="text"
              placeholder="Search order number…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="saas-input w-full"
            />
          </div>
          <div className="saas-segmented overflow-x-auto flex-nowrap">
            {ORDER_STATUS_TABS.map((st) => (
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
        mobileDetailOpen={!!selectedOrder}
        list={
          orders.length === 0 ? (
            <div className="saas-panel p-10 text-center text-sm text-portal-muted">
              No converted orders yet. Accept an RFQ and convert it to create an order.
            </div>
          ) : (
            orders.map((o) => {
              const c = orderContact(o);
              const isSelected = selectedOrder?.id === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrder(o)}
                  className={`saas-list-item space-y-1.5 ${isSelected ? 'saas-list-item-selected' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-id">{o.order_number}</span>
                    <span className={orderStatusBadgeClass(o.status)}>{formatStatusLabel(o.status)}</span>
                  </div>
                  <div className="text-sm font-medium text-portal-text truncate">{c.name}</div>
                  <div className="flex justify-between text-xs text-portal-muted font-mono pt-1 border-t border-portal-border">
                    <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    <span>₹{o.total?.toLocaleString('en-IN')}</span>
                  </div>
                </button>
              );
            })
          )
        }
        detail={
          selectedOrder ? (
            <div className="saas-panel p-5 space-y-4">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="lg:hidden saas-btn-ghost text-xs py-1.5 px-2 -ml-1 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to list
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-portal-border pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="type-section type-id">{selectedOrder.order_number}</h2>
                    <span className={orderStatusBadgeClass(selectedOrder.status)}>
                      {formatStatusLabel(selectedOrder.status)}
                    </span>
                    <span className={selectedOrder.payment_status === 'payment_done' ? 'saas-badge-success' : 'saas-badge-gold'}>
                      {selectedOrder.payment_status === 'payment_done' ? 'PAID' : 'UNPAID'}
                    </span>
                  </div>
                  <p className="text-xs text-portal-muted mt-1 flex flex-wrap gap-x-2">
                    {selectedOrder.enquiry_id && (
                      <Link href="/admin/enquiries" className="underline">
                        From enquiry
                      </Link>
                    )}
                    {selectedOrder.rfq_id && (
                      <Link href="/admin/rfqs" className="underline">
                        From RFQ {selectedOrder.rfq?.rfq_number || ''}
                      </Link>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="type-meta text-portal-muted">Total (inc. GST)</div>
                  <div className="type-kpi">₹{selectedOrder.total?.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {contact && (
                <ContactGrid
                  name={contact.name}
                  email={contact.email}
                  phone={contact.phone}
                  country={contact.country}
                />
              )}

              <div className="text-xs bg-portal-inset p-3 rounded-xl">
                <div className="type-meta text-portal-muted flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> Delivery address
                </div>
                <div className="text-portal-text leading-relaxed">
                  {contact?.addressLine1}
                  {contact?.addressLine2 && <>, {contact.addressLine2}</>}
                  <br />
                  {contact?.city}, {contact?.state} {contact?.postalCode}
                  <br />
                  {contact?.country}
                </div>
              </div>

              {actionError && <p className="text-xs text-portal-danger">{actionError}</p>}

              <div className="p-3 rounded-xl bg-portal-inset space-y-2">
                <span className="type-meta text-portal-muted">Order status</span>
                <div className="saas-segmented flex-wrap">
                  {(['accepted', 'packing', 'dispatched', 'cancelled'] as OrderStatus[]).map((st) => {
                    const isCurrent = selectedOrder.status === st;
                    const canMove =
                      isCurrent || allowedFrom(ORDER_STATUS_TRANSITIONS, st).includes(selectedOrder.status);
                    return (
                      <button
                        key={st}
                        disabled={orderBusy || !canMove}
                        onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                        className={isCurrent ? 'saas-tab-active' : 'saas-tab-inactive'}
                        title={!canMove ? `Cannot move to ${formatStatusLabel(st)} from current status` : undefined}
                      >
                        {formatStatusLabel(st)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-portal-inset">
                <span className="text-xs text-portal-muted">Payment</span>
                <button
                  disabled={orderBusy}
                  onClick={() =>
                    handleUpdatePayment(
                      selectedOrder.id,
                      selectedOrder.payment_status === 'payment_done' ? 'payment_required' : 'payment_done'
                    )
                  }
                  className={`saas-btn-${selectedOrder.payment_status === 'payment_done' ? 'secondary' : 'primary'} text-xs py-1.5 px-3`}
                >
                  {selectedOrder.payment_status === 'payment_done' ? 'Mark unpaid' : 'Mark paid'}
                </button>
              </div>

              <div className="saas-table-container">
                <table className="saas-table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Final unit price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((itm: any) => (
                      <tr key={itm.id}>
                        <td className="font-medium">{itm.product_name_snapshot}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className="saas-input text-xs w-20"
                            value={itm.quantity}
                            disabled={selectedOrder.status === 'dispatched' || selectedOrder.status === 'cancelled'}
                            onChange={(e) => {
                              const quantity = Math.max(1, Number(e.target.value) || 1);
                              setSelectedOrder({
                                ...selectedOrder,
                                items: selectedOrder.items.map((row: any) =>
                                  row.id === itm.id ? { ...row, quantity } : row
                                ),
                              });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="saas-input text-xs w-24"
                            value={itm.unit_price}
                            disabled={selectedOrder.status === 'dispatched' || selectedOrder.status === 'cancelled'}
                            onChange={(e) => {
                              const unit_price = Math.max(0, Number(e.target.value) || 0);
                              setSelectedOrder({
                                ...selectedOrder,
                                items: selectedOrder.items.map((row: any) =>
                                  row.id === itm.id ? { ...row, unit_price } : row
                                ),
                              });
                            }}
                          />
                        </td>
                        <td className="type-metric text-right">₹{itm.total?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedOrder.status !== 'dispatched' && selectedOrder.status !== 'cancelled' && (
                <button type="button" disabled={orderBusy} onClick={handleSaveOrderLines} className="saas-btn-secondary text-xs py-1.5 px-3">
                  Save line changes
                </button>
              )}

              {selectedOrder.tracking_token && (
                <button
                  type="button"
                  className="text-[11px] underline text-portal-muted"
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/track/${selectedOrder.tracking_token}`)
                  }
                >
                  Copy tracking link
                </button>
              )}

              {selectedOrder.rfq_id && (
                <Link href="/admin/rfqs" className="text-xs text-portal-muted inline-flex items-center gap-1">
                  View source RFQ <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-sm text-portal-muted">
              Select an order to manage status and payment.
            </div>
          )
        }
      />
      {total > PORTAL_PAGE_LIMIT && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            className="saas-btn-secondary text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="saas-btn-secondary text-xs"
            disabled={page * PORTAL_PAGE_LIMIT >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      <ManualOrderModal
        open={manualOrderOpen}
        onClose={() => setManualOrderOpen(false)}
        onCreated={() => loadOrders(true, { force: true })}
      />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">Loading orders…</div>
      }
    >
      <AdminOrdersPageContent />
    </Suspense>
  );
}
