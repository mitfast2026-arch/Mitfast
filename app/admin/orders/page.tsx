'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCart, 
  Search, 
  RefreshCw,
  Plus,
  X,
  Building,
  User,
  Package,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { OrderStatus, PaymentStatus } from '@/types/database';
import { apiGet, apiPost, apiPut } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();

  // Manual Order Creation Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Delivery Address
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('560100');
  const [country, setCountry] = useState('India');

  // Line items
  const [orderItems, setOrderItems] = useState<any[]>([
    { productId: '', quantity: 100, unitPrice: 0, gstRate: 18, gstIncluded: false, discount: 0 }
  ]);

  const [createOrderLoading, setCreateOrderLoading] = useState(false);
  const [createOrderError, setCreateOrderError] = useState('');

  const loadOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{ orders: any[] }>(`/api/orders?search=${encodeURIComponent(searchTerm)}`);
      if (result.ok) {
        const list = result.data.orders || [];
        setOrders(list);
        setSelectedOrder((prev: any) => {
          if (prev) {
            const updated = list.find((o: any) => o.id === prev.id);
            return updated || prev;
          }
          return list[0] || null;
        });
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function loadCustomersAndProducts() {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/products?mode=admin&limit=100'),
        fetch('/api/customers'),
      ]);
      const pJson = await pRes.json();
      if (pJson.success) setProducts(pJson.data.products || []);
      const cJson = await cRes.json();
      if (cJson.success) setCustomers(cJson.data.customers || []);
    } catch (err) {
      console.error('Failed to preload customers/products:', err);
    }
  }

  function openManualOrderModal() {
    loadCustomersAndProducts();
    setManualModalOpen(true);
    setCreateOrderError('');
  }

  function handleAddItem() {
    setOrderItems([
      ...orderItems,
      { productId: '', quantity: 50, unitPrice: 0, gstRate: 18, gstIncluded: false, discount: 0 }
    ]);
  }

  function handleRemoveItem(index: number) {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  }

  function handleItemChange(index: number, field: string, val: any) {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: val };

    if (field === 'productId') {
      const found = products.find(p => p.id === val);
      if (found) {
        updated[index].unitPrice = found.selling_price || 0;
        updated[index].gstRate = found.gst_rate || 18;
      }
    }

    setOrderItems(updated);
  }

  const computedSubtotal = orderItems.reduce((acc, itm) => acc + (Number(itm.unitPrice || 0) * Number(itm.quantity || 0)), 0);
  const computedGst = Math.round(computedSubtotal * 0.18);
  const computedTotal = computedSubtotal + computedGst;

  async function handleCreateManualOrder(e: React.FormEvent) {
    e.preventDefault();
    setCreateOrderError('');

    if (!selectedCustomerId) {
      setCreateOrderError('Please select a customer.');
      return;
    }

    const validItems = orderItems.filter(i => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setCreateOrderError('Please select at least one product with valid quantity.');
      return;
    }

    setCreateOrderLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        deliveryAddress: {
          address_line_1: addressLine1.trim() || 'Factory Consignment Yard',
          city: city.trim(),
          state: stateName.trim(),
          postal_code: postalCode.trim(),
          country: country.trim(),
        },
        items: validItems.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          gstRate: Number(i.gstRate || 18),
          gstIncluded: false,
          discount: 0,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCreateOrderError(json.error?.message || 'Failed to create manual order');
      } else {
        setManualModalOpen(false);
        loadOrders();
      }
    } catch (err: any) {
      setCreateOrderError(err.message || 'Server error creating manual order');
    } finally {
      setCreateOrderLoading(false);
    }
  }

  function patchOrder(orderId: string, patch: Record<string, unknown>) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
    setSelectedOrder((prev: any) => (prev?.id === orderId ? { ...prev, ...patch } : prev));
  }

  async function handleSaveOrderLines() {
    if (!selectedOrder) return;
    setActionError(null);
    await run(
      () =>
        apiPut(`/api/orders/${selectedOrder.id}`, {
          items: (selectedOrder.items || []).map((itm: any) => ({
            orderItemId: itm.id,
            productId: itm.product_id,
            quantity: Number(itm.quantity),
            unitPrice: Number(itm.unit_price),
            gstRate: itm.gst_rate ?? 18,
            gstIncluded: itm.gst_included ?? false,
            discount: itm.discount ?? 0,
          })),
        }),
      {
        key: mutationKey(selectedOrder.id, 'save-lines'),
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleUpdateStatus(orderId: string, newStatus: OrderStatus) {
    setActionError(null);
    await run(
      () => apiPut(`/api/orders/${orderId}/status`, { status: newStatus }),
      {
        key: mutationKey(orderId, `status-${newStatus}`),
        onSuccess: () => patchOrder(orderId, { status: newStatus }),
        onError: (msg) => setActionError(msg),
      }
    );
  }

  async function handleUpdatePayment(orderId: string, newPaymentStatus: PaymentStatus) {
    setActionError(null);
    await run(
      () => apiPut(`/api/orders/${orderId}/payment`, { paymentStatus: newPaymentStatus }),
      {
        key: mutationKey(orderId, `payment-${newPaymentStatus}`),
        onSuccess: () => patchOrder(orderId, { payment_status: newPaymentStatus }),
        onError: (msg) => setActionError(msg),
      }
    );
  }

  const orderBusy = selectedOrder
    ? isPending(mutationKey(selectedOrder.id, 'save-lines')) ||
      ['accepted', 'packing', 'shipped', 'delivered', 'cancelled'].some((s) =>
        isPending(mutationKey(selectedOrder.id, `status-${s}`))
      )
    : false;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Orders
          </h1>
          <p className="type-subtitle">
            Manage order fulfillment, shipment tracking milestones, payment confirmation, and manual order dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={openManualOrderModal}
            className="saas-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Manual Order</span>
          </button>

          <button 
            onClick={() => loadOrders()} 
            className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Orders List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="saas-panel p-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search by order number or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="saas-input pl-8 text-xs"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <div className="saas-panel p-12 text-center text-xs text-[#6B7280]">
                No orders found.
              </div>
            ) : (
              orders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    className={`saas-panel p-4 cursor-pointer transition-all space-y-2 ${
                      isSelected 
                        ? 'ring-2 ring-amber-500 shadow-md' 
                        : 'hover:bg-[#F7F7F8]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="type-id text-xs text-[#111315]">{o.order_number}</span>
                      <div className="flex gap-1.5">
                        <span className={
                          o.status === 'dispatched' 
                            ? 'saas-badge-success' 
                            : o.status === 'cancelled' 
                            ? 'saas-badge-danger' 
                            : 'saas-badge-gold'
                        }>
                          {o.status.toUpperCase()}
                        </span>
                        <span className={o.payment_status === 'payment_done' ? 'saas-badge-success' : 'saas-badge-gold'}>
                          {o.payment_status === 'payment_done' ? 'PAID' : 'UNPAID'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#6B7280]">
                      Customer: <span className="text-[#111315] font-medium">{o.customer?.full_name || 'Customer'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E4E8]">
                      <span className="text-[#6B7280]">{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className="type-metric text-[#111315]">
                        ₹{o.total?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Order Detail & Actions (7 cols) */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="saas-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E4E8] pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="type-section type-id">
                      {selectedOrder.order_number}
                    </h2>
                    <span className="saas-badge-cyan">{selectedOrder.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-[#6B7280] mt-1">
                    Customer: <b className="text-[#111315]">{selectedOrder.customer?.full_name}</b> ({selectedOrder.customer?.email})
                  </div>
                  {selectedOrder.tracking_token && (
                    <button
                      type="button"
                      className="text-[11px] underline text-[#6B7280] mt-1"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/track/${selectedOrder.tracking_token}`)}
                    >
                      Copy tracking link
                    </button>
                  )}
                </div>

                <div className="text-right">
                  <div className="type-meta text-[#6B7280]">Total (inc. GST)</div>
                  <div className="type-kpi text-[#111315]">
                    ₹{selectedOrder.total?.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Status Controls */}
              <div className="p-4 rounded-xl bg-[#F7F7F8] space-y-2">
                <div className="type-section">
                  Update fulfillment stage
                </div>
                <div className="saas-segmented flex-wrap">
                  {(['accepted', 'packing', 'dispatched', 'cancelled'] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={orderBusy}
                      onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                      className={selectedOrder.status === st ? 'saas-tab-active' : 'saas-tab-inactive'}
                    >
                      {st.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status Toggle */}
              <div className="p-4 rounded-xl bg-[#F7F7F8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#111315]">Payment Status</div>
                  <div className="text-xs text-[#6B7280] mt-0.5">
                    Current: <b className="text-[#111315] uppercase">{selectedOrder.payment_status === 'payment_done' ? 'Paid' : 'Payment Required'}</b>
                  </div>
                </div>
                <button
                  disabled={orderBusy || isPending(mutationKey(selectedOrder.id, 'payment-payment_done')) || isPending(mutationKey(selectedOrder.id, 'payment-payment_required'))}
                  onClick={() => handleUpdatePayment(
                    selectedOrder.id, 
                    selectedOrder.payment_status === 'payment_done' ? 'payment_required' : 'payment_done'
                  )}
                  className={`saas-btn-${selectedOrder.payment_status === 'payment_done' ? 'secondary' : 'primary'} text-xs py-1.5 px-3`}
                >
                  {selectedOrder.payment_status === 'payment_done' ? 'Mark as Unpaid' : 'Mark as Paid'}
                </button>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="type-section">
                  Order line items
                </div>
                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Supplier</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th className="text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items?.map((itm: any) => (
                        <tr key={itm.id}>
                          <td className="font-medium text-[#111315]">
                            {itm.product_name_snapshot}
                          </td>
                          <td className="text-[#6B7280]">
                            {itm.supplier_name_snapshot}
                          </td>
                          <td className="type-metric">
                            <input
                              type="number"
                              min={1}
                              className="saas-input text-xs w-20"
                              value={itm.quantity}
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
                          <td className="type-metric">
                            <input
                              type="number"
                              min={0}
                              className="saas-input text-xs w-24"
                              value={itm.unit_price}
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
                          <td className="type-metric text-right text-[#111315]">
                            ₹{itm.total?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedOrder.status !== 'dispatched' && selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={orderBusy || isPending(mutationKey(selectedOrder.id, 'payment-payment_done')) || isPending(mutationKey(selectedOrder.id, 'payment-payment_required'))}
                    onClick={handleSaveOrderLines}
                    className="saas-btn-secondary text-xs py-1.5 px-3"
                  >
                    Save line changes
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-[#6B7280]">
              Select an order from the list to view details and update fulfillment status.
            </div>
          )}
        </div>
      </div>

      {/* CREATE MANUAL DIRECT ORDER MODAL */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateManualOrder} className="w-full max-w-3xl p-6 sm:p-8 rounded-2xl bg-white shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#111315]">
                  Create Direct Commercial Order
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Generate an immutable production order for offline or contracted buyers.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setManualModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createOrderError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createOrderError}</span>
              </div>
            )}

            {/* Customer Selector */}
            <div className="space-y-1.5">
              <label className="saas-label">Target buyer *</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="saas-input text-xs"
              >
                <option value="">-- Select Registered Buyer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#111315] uppercase font-mono">
                  Order Line Items
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="saas-neu-button text-xs py-1 px-2.5 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Component</span>
                </button>
              </div>

              <div className="space-y-2">
                {orderItems.map((itm, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#F7F7F8] border border-[#E2E4E8] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-[10px] font-mono text-[#6B7280]">Component Product *</label>
                      <select
                        required
                        value={itm.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="saas-input text-xs"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Base ₹{p.selling_price})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-mono text-[#6B7280]">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={itm.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="saas-input text-xs text-center"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono text-[#6B7280]">Agreed Unit Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={itm.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="saas-input text-xs text-right font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={orderItems.length === 1}
                        className="p-1.5 rounded text-[#6B7280] hover:text-[#B91C1C] disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-3 pt-2 border-t border-[#E2E4E8]">
              <div className="text-xs font-bold text-[#111315] uppercase font-mono">
                Delivery Consignment Location
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="saas-label">Address Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="e.g. Plot 14, Electronic City Phase 1"
                    className="saas-input text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="saas-label">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="saas-label">State *</label>
                  <input
                    type="text"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="saas-label">Postal Code *</label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="saas-input text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="saas-label">Country</label>
                  <input
                    type="text"
                    disabled
                    value={country}
                    className="saas-input text-xs bg-[#F7F7F8] text-[#6B7280]"
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-[#111315] text-white flex items-center justify-between font-mono">
              <div className="text-xs space-y-0.5 text-[#D7D9DC]">
                <div>Subtotal: ₹{computedSubtotal.toLocaleString('en-IN')}</div>
                <div>GST (18%): ₹{computedGst.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Final Order Total</div>
                <div className="text-xl font-bold text-white">
                  ₹{computedTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setManualModalOpen(false)}
                className="saas-btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={createOrderLoading}
                className="saas-btn-primary text-xs py-2 px-5"
              >
                {createOrderLoading ? 'Generating Order...' : 'Generate Confirmed Order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
