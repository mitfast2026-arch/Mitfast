'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import PortalModal from '@/components/admin/PortalModal';
import { apiPost } from '@/lib/client/api-client';
import { cachedApiGet } from '@/lib/client/portal-data-cache';
import { toast } from 'sonner';

type CustomerOption = {
  id: string;
  full_name: string | null;
  email: string;
};

type ProductOption = {
  id: string;
  name: string;
  selling_price: number;
  moq: number;
};

type LineItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type ManualOrderModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const emptyAddress = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
};

export default function ManualOrderModal({ open, onClose, onCreated }: ManualOrderModalProps) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setLoadingOptions(true);
    Promise.all([
      cachedApiGet<{ customers: CustomerOption[] }>('/api/customers?limit=100', { force: true }),
      cachedApiGet<{ products: ProductOption[] }>(
        '/api/products?mode=admin&limit=100&publicationStatus=published&archiveStatus=active',
        { force: true }
      ),
    ])
      .then(([custRes, prodRes]) => {
        if (custRes.ok) setCustomers(custRes.data.customers || []);
        if (prodRes.ok) setProducts(prodRes.data.products || []);
      })
      .finally(() => setLoadingOptions(false));
  }, [open]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onProductChange(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateItem(index, {
      productId,
      unitPrice: product ? Number(product.selling_price) || 0 : 0,
      quantity: product ? Math.max(1, Number(product.moq) || 1) : 1,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!customerId) {
      setErrorMsg('Select a customer.');
      return;
    }
    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Add at least one product line.');
      return;
    }

    setSubmitting(true);
    const result = await apiPost<{ orderId: string; orderNumber: string }>(
      '/api/orders',
      {
        customerId,
        deliveryAddress: {
          address_line_1: address.address_line_1.trim(),
          address_line_2: address.address_line_2.trim() || null,
          city: address.city.trim(),
          state: address.state.trim(),
          postal_code: address.postal_code.trim(),
          country: address.country.trim() || 'India',
        },
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          gstRate: 18,
          gstIncluded: false,
          discount: 0,
        })),
      },
      { idempotencyKey: crypto.randomUUID() }
    );

    setSubmitting(false);
    if (!result.ok) {
      setErrorMsg(result.message);
      toast.error(result.message);
      return;
    }

    toast.success(`Order ${result.data.orderNumber} created`);
    onCreated();
    onClose();
    setCustomerId('');
    setAddress(emptyAddress);
    setItems([{ productId: '', quantity: 1, unitPrice: 0 }]);
  }

  return (
    <PortalModal
      open={open}
      onClose={onClose}
      title="Create manual order"
      maxWidth="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="saas-btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="manual-order-form"
            className="saas-btn-primary gap-2"
            disabled={submitting || loadingOptions}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create order
          </button>
        </>
      }
    >
      {loadingOptions ? (
        <div className="flex items-center justify-center py-10 text-sm text-portal-muted gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading customers and products…
        </div>
      ) : (
        <form id="manual-order-form" onSubmit={handleSubmit} className="space-y-4">
          {errorMsg ? (
            <p className="text-xs text-portal-danger bg-portal-danger-soft border border-portal-danger/30 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="saas-label">Customer *</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="saas-input w-full"
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.full_name || c.email) + ` (${c.email})`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="saas-label">Address line 1 *</label>
              <input
                required
                className="saas-input w-full"
                value={address.address_line_1}
                onChange={(e) => setAddress((a) => ({ ...a, address_line_1: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="saas-label">Address line 2</label>
              <input
                className="saas-input w-full"
                value={address.address_line_2}
                onChange={(e) => setAddress((a) => ({ ...a, address_line_2: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="saas-label">City *</label>
              <input
                required
                className="saas-input w-full"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="saas-label">State *</label>
              <input
                required
                className="saas-input w-full"
                value={address.state}
                onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="saas-label">Postal code *</label>
              <input
                required
                className="saas-input w-full"
                value={address.postal_code}
                onChange={(e) => setAddress((a) => ({ ...a, postal_code: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="saas-label">Country</label>
              <input
                className="saas-input w-full"
                value={address.country}
                onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-portal-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-portal-muted">Line items</span>
              <button
                type="button"
                className="saas-btn-ghost text-xs gap-1"
                onClick={() =>
                  setItems((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0 }])
                }
              >
                <Plus className="w-3.5 h-3.5" />
                Add line
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <label className="saas-label">Product</label>
                  <select
                    required
                    className="saas-input w-full"
                    value={item.productId}
                    onChange={(e) => onProductChange(index, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <label className="saas-label">Qty</label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="saas-input w-full"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                  />
                </div>
                <div className="col-span-6 sm:col-span-3 space-y-1">
                  <label className="saas-label">Unit price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    className="saas-input w-full"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                  />
                </div>
                <div className="col-span-2 flex justify-end pb-1">
                  {items.length > 1 ? (
                    <button
                      type="button"
                      className="saas-btn-ghost text-portal-danger p-2"
                      aria-label="Remove line"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </form>
      )}
    </PortalModal>
  );
}
