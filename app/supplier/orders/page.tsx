'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Search,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  Check,
  RotateCcw,
  Inbox,
  AlertCircle,
  Tag,
  Hash,
} from 'lucide-react';
import { apiGet, apiPut } from '@/lib/client/api-client';
import { SUPPLIER_PORTAL_LIST_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { toast } from 'sonner';

interface SupplierOrderItem {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  sku: string | null;
  moq: number;
  quantity: number;
  unit_price: number;
  total: number;
  primary_image_url: string | null;
  specifications: Array<{ key: string; value: string }>;
  description: string | null;
}

interface SupplierOrder {
  id: string;
  order_number: string;
  status: 'accepted' | 'packing' | 'dispatched' | 'cancelled';
  payment_status: string;
  is_contacted: boolean;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_quantity: number;
  supplier_total: number;
  items: SupplierOrderItem[];
}

interface OrderCounts {
  new: number;
  contacted: number;
  total: number;
}

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [counts, setCounts] = useState<OrderCounts>({ new: 0, contacted: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<'new' | 'contacted' | 'all'>('new');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = `/api/supplier/orders?page=${page}&limit=${SUPPLIER_PORTAL_LIST_LIMIT}&search=${encodeURIComponent(
        debouncedSearch
      )}&filter=${activeTab}`;
      const json = await apiGet<{
        orders: SupplierOrder[];
        counts: OrderCounts;
        total: number;
        page: number;
      }>(url);

      if (json.ok && json.data) {
        setOrders(json.data.orders || []);
        if (json.data.counts) {
          setCounts(json.data.counts);
        }
        setTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load supplier orders:', err);
      toast.error('Failed to refresh orders.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, debouncedSearch, activeTab]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function handleToggleContacted(orderId: string, currentContacted: boolean) {
    setUpdatingId(orderId);
    const newContacted = !currentContacted;

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              is_contacted: newContacted,
              contacted_at: newContacted ? new Date().toISOString() : null,
            }
          : o
      )
    );

    if (activeTab === 'new' && newContacted) {
      setCounts((c) => ({
        ...c,
        new: Math.max(0, c.new - 1),
        contacted: c.contacted + 1,
      }));
    } else if (activeTab === 'contacted' && !newContacted) {
      setCounts((c) => ({
        ...c,
        new: c.new + 1,
        contacted: Math.max(0, c.contacted - 1),
      }));
    }

    try {
      const res = await apiPut<{ orderId: string; is_contacted: boolean; contacted_at: string | null }>(
        `/api/supplier/orders/${orderId}/contact`,
        { contacted: newContacted }
      );

      if (res.ok) {
        toast.success(newContacted ? 'Order marked as contacted.' : 'Order moved back to New.');
        void loadOrders(true);
      } else {
        toast.error(res.message || 'Failed to update order status');
        void loadOrders(true);
      }
    } catch {
      toast.error('Network error updating status');
      void loadOrders(true);
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / SUPPLIER_PORTAL_LIST_LIMIT));

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Fulfillment Orders</h1>
          <p className="type-subtitle">
            Confirmed buyer orders assigned to your catalog. Review product specifications and acknowledge when contacted.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders()}
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary Workflow Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-portal-inset p-1 rounded-xl border border-portal-border overflow-x-auto max-w-full shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'new'
                ? 'bg-portal-primary text-white shadow-sm'
                : 'text-portal-muted hover:text-portal-text'
            }`}
          >
            <span>New Orders</span>
            {counts.new > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'new'
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-amber-500/20 text-amber-600'
                }`}
              >
                {counts.new}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacted')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'contacted'
                ? 'bg-portal-primary text-white shadow-sm'
                : 'text-portal-muted hover:text-portal-text'
            }`}
          >
            <span>Contacted</span>
            {counts.contacted > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'contacted'
                    ? 'bg-emerald-400 text-slate-900'
                    : 'bg-emerald-500/20 text-emerald-600'
                }`}
              >
                {counts.contacted}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-portal-primary text-white shadow-sm'
                : 'text-portal-muted hover:text-portal-text'
            }`}
          >
            <span>All ({counts.total})</span>
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs w-full">
          <input
            type="text"
            placeholder="Search by order number…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input pl-8 text-xs py-1.5 w-full"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-portal-muted" />
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="saas-panel p-6 h-40 bg-portal-inset/40 rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="saas-panel p-16 text-center space-y-3 rounded-2xl">
            <Inbox className="w-10 h-10 mx-auto text-portal-muted opacity-50" />
            <h3 className="text-sm font-semibold text-portal-text">
              {activeTab === 'new'
                ? 'No new orders requiring attention'
                : activeTab === 'contacted'
                ? 'No contacted orders yet'
                : 'No orders found'}
            </h3>
            <p className="text-xs text-portal-muted max-w-sm mx-auto">
              {activeTab === 'new'
                ? 'When MITFAST Admin converts accepted requests, confirmed purchase orders will appear in this active queue.'
                : 'Orders acknowledged with "Mark as Contacted" are stored here for fulfillment reference.'}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const isContacted = order.is_contacted;
            const isUpdating = updatingId === order.id;

            return (
              <div
                key={order.id}
                className={`saas-panel p-5 rounded-2xl transition-all border ${
                  isContacted
                    ? 'border-portal-border/60 bg-portal-inset/30 opacity-80 hover:opacity-100'
                    : 'border-portal-border bg-portal-surface shadow-sm ring-1 ring-amber-500/10'
                }`}
              >
                {/* Card Header: Order Reference & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-portal-border/70 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-portal-text">
                      <Hash className="w-3.5 h-3.5 text-portal-muted" />
                      <span>{order.order_number}</span>
                    </div>

                    <span
                      className={
                        order.status === 'dispatched'
                          ? 'saas-badge-success text-[10px]'
                          : order.status === 'packing'
                          ? 'saas-badge-cyan text-[10px]'
                          : order.status === 'cancelled'
                          ? 'saas-badge-danger text-[10px]'
                          : 'saas-badge-gold text-[10px]'
                      }
                    >
                      {order.status === 'packing' ? 'PICKING / PACKING' : order.status.toUpperCase()}
                    </span>

                    <span className="text-[11px] text-portal-muted font-mono flex items-center gap-1 ml-2">
                      <Calendar className="w-3 h-3 text-portal-muted" />
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Supplier Workflow Action */}
                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    {isContacted ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Contacted</span>
                          {order.contacted_at && (
                            <span className="text-[10px] text-emerald-600/80 font-mono">
                              ({new Date(order.contacted_at).toLocaleDateString()})
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleContacted(order.id, true)}
                          disabled={isUpdating}
                          className="saas-btn-ghost text-[11px] py-1 px-2 text-portal-muted hover:text-portal-text flex items-center gap-1"
                          title="Move back to New Orders"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleContacted(order.id, false)}
                        disabled={isUpdating}
                        className="saas-btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm font-semibold"
                      >
                        {isUpdating ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                        <span>Mark as Contacted</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Line Items */}
                <div className="pt-3 space-y-3">
                  {order.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-portal-inset/60 border border-portal-border/40"
                    >
                      {/* Left: Product Thumbnail + Title + SKU */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-lg bg-portal-surface border border-portal-border flex items-center justify-center overflow-hidden shrink-0 relative">
                          {item.primary_image_url ? (
                            <Image
                              src={item.primary_image_url}
                              alt={item.product_name_snapshot}
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-portal-muted opacity-40" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-portal-text truncate">
                            {item.product_name_snapshot}
                          </h4>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {item.sku && (
                              <span className="font-mono bg-portal-surface border border-portal-border px-1.5 py-0.2 rounded text-portal-muted flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                {item.sku}
                              </span>
                            )}
                            <span className="font-mono bg-portal-surface border border-portal-border px-1.5 py-0.2 rounded text-portal-muted">
                              MOQ: {item.moq}
                            </span>
                            {item.specifications && item.specifications.length > 0 && (
                              <span className="text-portal-muted text-[10px] truncate max-w-xs">
                                • {item.specifications.map((s) => `${s.key}: ${s.value}`).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity & Approved Supplier Price */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-portal-border/40">
                        <div className="text-left sm:text-right">
                          <div className="text-[10px] uppercase text-portal-muted font-semibold">
                            Fulfillment Qty
                          </div>
                          <div className="text-xs sm:text-sm font-mono font-bold text-portal-text">
                            {item.quantity} Units
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase text-portal-muted font-semibold">
                            Agreed Price
                          </div>
                          <div className="text-xs sm:text-sm font-mono font-bold text-portal-text">
                            ₹{item.unit_price?.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-portal-border">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <span className="text-xs text-portal-muted font-mono">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
