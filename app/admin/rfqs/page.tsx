'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  Plus,
  Trash2,
  Package,
  UserCheck,
} from 'lucide-react';
import { apiPost, apiPut } from '@/lib/client/api-client';
import {
  cachedApiGet,
  invalidatePortalCache,
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

type LineItemDraft = {
  id?: string;
  productId?: string;
  productNameSnapshot: string;
  originalQuantity: number;
  originalUnitPrice: number;
  finalQuantity?: number | null;
  finalUnitPrice?: number | null;
  moq?: number;
};

export default function AdminRfqsPage() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { isPending, run } = useMutation();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [convertSuccess, setConvertSuccess] = useState('');

  // Editable Line Items
  const [itemsDraft, setItemsDraft] = useState<LineItemDraft[]>([]);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [itemsSaveSuccess, setItemsSaveSuccess] = useState('');

  // Add Product from Catalog
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addUnitPrice, setAddUnitPrice] = useState<number>(0);

  // Editable Customer & Delivery Details
  const [editCustName, setEditCustName] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustCompany, setEditCustCompany] = useState('');
  const [editAddressLine1, setEditAddressLine1] = useState('');
  const [editAddressLine2, setEditAddressLine2] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCountry, setEditCountry] = useState('India');
  const [editNotes, setEditNotes] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);

  const loadRfqs = useCallback(async (showLoading = true, opts?: { force?: boolean }) => {
    const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
    const url = `/api/rfqs?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}${statusParam}`;
    const force = Boolean(opts?.force);
    const existing = force ? null : peekPortalCache<{ rfqs: any[]; total: number }>(url);
    if (existing) {
      const list = existing.data.rfqs || [];
      setRfqs(list);
      setTotal(existing.data.total || 0);
      setSelectedRfq((prev: any) => {
        if (prev) {
          const updated = list.find((r: any) => r.id === prev.id);
          if (updated) {
            initRfqForms(updated);
            return updated;
          }
        }
        if (list[0]) {
          initRfqForms(list[0]);
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
        force: force || (showLoading && !existing),
      });
      if (result.ok) {
        const list = result.data.rfqs || [];
        setRfqs(list);
        setTotal(result.data.total || 0);
        setSelectedRfq((prev: any) => {
          if (prev) {
            const updated = list.find((r: any) => r.id === prev.id);
            if (updated) {
              initRfqForms(updated);
              return updated;
            }
          }
          if (list[0]) {
            initRfqForms(list[0]);
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
  }, [debouncedSearch, page, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  // Catalog search for adding products to RFQ
  useEffect(() => {
    const q = catalogSearch.trim();
    const ac = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/products?mode=admin&limit=50&search=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setCatalogProducts(json.data.products || []);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [catalogSearch]);

  function initRfqForms(rfq: any) {
    if (!rfq) return;

    // Line items
    const rawItems: LineItemDraft[] = (rfq.items || []).map((itm: any) => ({
      id: itm.id,
      productId: itm.product_id,
      productNameSnapshot: itm.product_name_snapshot,
      originalQuantity: itm.original_quantity || 1,
      originalUnitPrice: Number(itm.original_unit_price || 0),
      finalQuantity: itm.final_quantity,
      finalUnitPrice: itm.final_unit_price != null ? Number(itm.final_unit_price) : null,
      moq: itm.product?.moq || 1,
    }));
    setItemsDraft(rawItems);

    // Customer & Address
    const addr = rfq.delivery_address_snapshot || {};
    setEditAddressLine1(addr.address_line_1 || '');
    setEditAddressLine2(addr.address_line_2 || '');
    setEditCity(addr.city || '');
    setEditState(addr.state || '');
    setEditPostalCode(addr.postal_code || '');
    setEditCountry(addr.country || 'India');

    const cust = rfq.customer || rfq.enquiry || {};
    setEditCustName(cust.full_name || cust.guest_name || '');
    setEditCustEmail(cust.email || cust.guest_email || '');
    setEditCustPhone(cust.phone || cust.guest_phone || '');
    setEditCustCompany(cust.company_name || '');
    setEditNotes(rfq.customer_message || '');

    setShowReject(false);
    setRejectReason('');
    setActionError(null);
    setConvertSuccess('');
    setItemsSaveSuccess('');
  }

  function handleSelectRfq(rfq: any) {
    setSelectedRfq(rfq);
    initRfqForms(rfq);
  }

  function patchRfq(rfqId: string, patch: Record<string, unknown>) {
    setRfqs((prev) => prev.map((r) => (r.id === rfqId ? { ...r, ...patch } : r)));
    setSelectedRfq((prev: any) => (prev?.id === rfqId ? { ...prev, ...patch } : prev));
  }

  // Live total calculation
  const calculatedTotals = useMemo(() => {
    let orig = 0;
    let final = 0;
    let hasFinal = false;

    for (const item of itemsDraft) {
      const oQty = item.originalQuantity || 1;
      const oPrice = item.originalUnitPrice || 0;
      orig += oQty * oPrice;

      if (item.finalUnitPrice !== null && item.finalUnitPrice !== undefined) {
        hasFinal = true;
        const fQty = item.finalQuantity || oQty;
        final += fQty * item.finalUnitPrice;
      } else {
        const fQty = item.finalQuantity || oQty;
        final += fQty * oPrice;
      }
    }

    return {
      originalTotal: Math.round(orig * 100) / 100,
      finalTotal: hasFinal ? Math.round(final * 100) / 100 : Math.round(orig * 100) / 100,
      hasFinalPrice: hasFinal,
    };
  }, [itemsDraft]);

  function handleUpdateLineQty(idx: number, qty: number) {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, originalQuantity: Math.max(1, qty) } : item))
    );
  }

  function handleUpdateLineUnitPrice(idx: number, price: number) {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, originalUnitPrice: Math.max(0, price) } : item))
    );
  }

  function handleUpdateFinalQty(idx: number, qty: number | null) {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, finalQuantity: qty } : item))
    );
  }

  function handleUpdateFinalUnitPrice(idx: number, price: number | null) {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, finalUnitPrice: price } : item))
    );
  }

  function handleRemoveLineItem(idx: number) {
    if (itemsDraft.length <= 1) {
      setActionError('An RFQ must contain at least one product line item.');
      return;
    }
    setActionError(null);
    setItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddProductSelect(productId: string) {
    setSelectedAddProductId(productId);
    const prod = catalogProducts.find((p) => p.id === productId);
    if (prod) {
      setAddQty(prod.moq || 1);
      setAddUnitPrice(Number(prod.selling_price || 0));
    }
  }

  function handleAddProductToRfq() {
    if (!selectedAddProductId) return;
    const prod = catalogProducts.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    const newItem: LineItemDraft = {
      productId: prod.id,
      productNameSnapshot: prod.name,
      originalQuantity: Math.max(1, addQty || prod.moq || 1),
      originalUnitPrice: Math.max(0, addUnitPrice || Number(prod.selling_price || 0)),
      moq: prod.moq || 1,
    };

    setItemsDraft((prev) => [...prev, newItem]);
    setSelectedAddProductId('');
    setAddQty(1);
    setAddUnitPrice(0);
    setActionError(null);
  }

  async function handleSaveRfqItems() {
    if (!selectedRfq) return;
    if (itemsDraft.length === 0) {
      setActionError('An RFQ must contain at least one product line item.');
      return;
    }

    setItemsSaving(true);
    setActionError(null);
    setItemsSaveSuccess('');

    try {
      const payload = {
        items: itemsDraft.map((item) => ({
          id: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.originalQuantity,
          unitPrice: item.originalUnitPrice,
          finalQuantity: item.finalQuantity,
          finalUnitPrice: item.finalUnitPrice,
        })),
      };

      const res = await apiPut(`/api/rfqs/${selectedRfq.id}`, payload);
      if (!res.ok) {
        setActionError(res.message || 'Failed to save RFQ line items');
        return;
      }

      setItemsSaveSuccess('Line items and pricing updated successfully!');
      invalidatePortalCache('/api/rfqs');
      await loadRfqs(false, { force: true });
      notifyDashboardChanged();
    } catch {
      setActionError('Failed to save RFQ line items');
    } finally {
      setItemsSaving(false);
    }
  }

  async function handleSaveDetails() {
    if (!selectedRfq) return;
    setDetailsSaving(true);
    setActionError(null);

    try {
      const payload = {
        items: itemsDraft.map((item) => ({
          id: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.originalQuantity,
          unitPrice: item.originalUnitPrice,
          finalQuantity: item.finalQuantity,
          finalUnitPrice: item.finalUnitPrice,
        })),
        deliveryAddress: {
          address_line_1: editAddressLine1.trim() || 'To be confirmed',
          address_line_2: editAddressLine2.trim() || null,
          city: editCity.trim() || 'TBD',
          state: editState.trim() || 'TBD',
          postal_code: editPostalCode.trim() || '000000',
          country: editCountry.trim() || 'India',
        },
        customerMessage: editNotes.trim() || null,
        contact: {
          fullName: editCustName.trim(),
          email: editCustEmail.trim().toLowerCase(),
          phone: editCustPhone.trim(),
          companyName: editCustCompany.trim() || undefined,
        },
      };

      const res = await apiPut(`/api/rfqs/${selectedRfq.id}`, payload);
      if (!res.ok) {
        setActionError(res.message || 'Failed to save customer/delivery details');
        return;
      }

      invalidatePortalCache('/api/rfqs');
      await loadRfqs(false, { force: true });
      notifyDashboardChanged();
    } catch {
      setActionError('Failed to save customer and delivery details');
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleAcceptRfq() {
    if (!selectedRfq) return;
    setActionError(null);

    // Persist latest lines before accepting
    await handleSaveRfqItems();

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
    await run(
      () =>
        apiPost(`/api/rfqs/${selectedRfq.id}/convert-to-order`, undefined, {
          idempotencyKey:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `convert-${selectedRfq.id}-${Date.now()}`,
        }),
      {
        key: mutationKey(selectedRfq.id, 'convert'),
        onSuccess: (data) => {
          patchRfq(selectedRfq.id, { status: 'converted_to_order' });
          setConvertSuccess((data as { orderNumber?: string })?.orderNumber || 'Order created');
          notifyDashboardChanged();
        },
        onError: (msg) => setActionError(msg),
      }
    );
  }

  const rfqBusy = selectedRfq
    ? isPending(mutationKey(selectedRfq.id, 'accept')) ||
      isPending(mutationKey(selectedRfq.id, 'reject')) ||
      isPending(mutationKey(selectedRfq.id, 'convert')) ||
      itemsSaving ||
      detailsSaving
    : false;

  const contact = selectedRfq ? rfqContact(selectedRfq) : null;
  const isLocked = selectedRfq?.status === 'converted_to_order' || selectedRfq?.status === 'rejected';

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        title="RFQs"
        description="Quotation requests — review products, edit line items, negotiate pricing, accept, then convert to order."
        actions={
          <button onClick={() => loadRfqs(true, { force: true })} className="saas-btn-secondary gap-2">
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
        mobileDetailOpen={!!selectedRfq}
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
                    <span>{r.items?.length || 0} product line(s)</span>
                    <span>₹{(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}</span>
                  </div>
                </button>
              );
            })
          )
        }
        detail={
          selectedRfq ? (
            <div className="saas-panel p-4 sm:p-5 space-y-5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedRfq(null)}
                className="lg:hidden saas-btn-ghost text-xs py-1.5 px-2 -ml-1 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to list
              </button>
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
              {itemsSaveSuccess && <p className="text-xs text-portal-success bg-portal-success-soft p-2 rounded-lg">{itemsSaveSuccess}</p>}
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

              {/* Product line items management table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="type-meta text-portal-muted flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Product Line Items ({itemsDraft.length})
                  </span>
                  <div className="text-xs font-mono font-bold text-portal-text">
                    Total: ₹{calculatedTotals.finalTotal.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Listed unit</th>
                        <th>Negotiated unit</th>
                        <th className="text-right">Line total</th>
                        {!isLocked && <th className="text-center w-10">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {itemsDraft.map((item, idx) => {
                        const effectivePrice = item.finalUnitPrice ?? item.originalUnitPrice;
                        const effectiveQty = item.finalQuantity ?? item.originalQuantity;
                        const lineTotal = effectiveQty * effectivePrice;

                        return (
                          <tr key={item.id || idx}>
                            <td className="font-medium">
                              <div>{item.productNameSnapshot}</div>
                              {item.moq && (
                                <span className="text-[10px] text-portal-muted">MOQ: {item.moq}</span>
                              )}
                            </td>
                            <td>
                              {isLocked ? (
                                <span className="type-metric">{effectiveQty}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={1}
                                  value={item.originalQuantity}
                                  onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                                  className="saas-input type-metric w-20 py-1 px-2 text-xs"
                                />
                              )}
                            </td>
                            <td>
                              {isLocked ? (
                                <span className="type-metric text-portal-muted">₹{item.originalUnitPrice?.toLocaleString('en-IN')}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  value={item.originalUnitPrice}
                                  onChange={(e) => handleUpdateLineUnitPrice(idx, parseFloat(e.target.value) || 0)}
                                  className="saas-input type-metric w-24 py-1 px-2 text-xs"
                                />
                              )}
                            </td>
                            <td>
                              {isLocked ? (
                                <span className="type-metric">₹{effectivePrice?.toLocaleString('en-IN')}</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="Auto"
                                  value={item.finalUnitPrice !== null && item.finalUnitPrice !== undefined ? item.finalUnitPrice : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? null : parseFloat(e.target.value) || 0;
                                    handleUpdateFinalUnitPrice(idx, val);
                                  }}
                                  className="saas-input type-metric w-24 py-1 px-2 text-xs"
                                />
                              )}
                            </td>
                            <td className="type-metric text-right font-bold">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </td>
                            {!isLocked && (
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLineItem(idx)}
                                  disabled={itemsDraft.length <= 1}
                                  title={itemsDraft.length <= 1 ? 'RFQ must contain at least 1 product' : 'Remove product line'}
                                  className="p-1 rounded text-portal-muted hover:text-portal-danger disabled:opacity-30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add product from catalog inline form */}
                {!isLocked && (
                  <div className="p-3 rounded-xl bg-portal-inset/50 border border-portal-border space-y-2">
                    <span className="text-[11px] font-medium text-portal-text">Add product to this RFQ</span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        className="saas-input text-xs"
                        placeholder="Search catalog…"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                      />
                      <select
                        className="saas-input text-xs"
                        value={selectedAddProductId}
                        onChange={(e) => handleAddProductSelect(e.target.value)}
                      >
                        <option value="">Select product</option>
                        {catalogProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (MOQ: {p.moq || 1})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={addQty}
                          onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="saas-input text-xs w-20"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Price"
                          value={addUnitPrice}
                          onChange={(e) => setAddUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="saas-input text-xs w-24"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddProductToRfq}
                        disabled={!selectedAddProductId}
                        className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add line
                      </button>
                    </div>
                  </div>
                )}

                {!isLocked && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[11px] text-portal-muted">
                      Original total: ₹{calculatedTotals.originalTotal.toLocaleString('en-IN')} · Final total: ₹{calculatedTotals.finalTotal.toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveRfqItems}
                      disabled={itemsSaving}
                      className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {itemsSaving ? 'Saving…' : 'Save line item edits'}
                    </button>
                  </div>
                )}
              </div>

              {/* Customer and Delivery details editor */}
              <div className="pt-3 border-t border-portal-border space-y-3">
                <span className="type-meta text-portal-muted flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Customer & Delivery Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-portal-text">Contact Information</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="saas-input text-xs" value={editCustName} onChange={(e) => setEditCustName(e.target.value)} placeholder="Full Name" />
                      <input className="saas-input text-xs" value={editCustCompany} onChange={(e) => setEditCustCompany(e.target.value)} placeholder="Company" />
                      <input className="saas-input text-xs" value={editCustEmail} onChange={(e) => setEditCustEmail(e.target.value)} placeholder="Email" />
                      <input className="saas-input text-xs" value={editCustPhone} onChange={(e) => setEditCustPhone(e.target.value)} placeholder="Phone" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-portal-text flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Delivery Address
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="saas-input text-xs col-span-2" value={editAddressLine1} onChange={(e) => setEditAddressLine1(e.target.value)} placeholder="Address line 1" />
                      <input className="saas-input text-xs" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
                      <input className="saas-input text-xs" value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" />
                      <input className="saas-input text-xs" value={editPostalCode} onChange={(e) => setEditPostalCode(e.target.value)} placeholder="Postal Code" />
                      <input className="saas-input text-xs" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} placeholder="Country" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-portal-muted flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Customer Notes / Instructions
                  </label>
                  <textarea
                    className="saas-input text-xs min-h-[50px]"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Customer message or notes…"
                  />
                </div>

                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={detailsSaving}
                    className="saas-btn-secondary text-xs py-1.5 px-3"
                  >
                    {detailsSaving ? 'Saving…' : 'Save customer & address details'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-sm text-portal-muted">
              Select an RFQ to negotiate pricing and manage status.
            </div>
          )
        }
      />
      {total > PORTAL_PAGE_LIMIT && (
        <div className="flex justify-end gap-2">
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
    </div>
  );
}
