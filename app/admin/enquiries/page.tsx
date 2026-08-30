'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  Trash2,
  ArrowRight,
  ChevronLeft,
  Plus,
  Package,
} from 'lucide-react';
import { apiPut, apiDelete } from '@/lib/client/api-client';
import {
  cachedApiGet,
  invalidatePortalCache,
  markPortalContentReady,
  peekPortalCache,
  setPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyDashboardChanged } from '@/components/portal/ApprovalsCountContext';
import type { EnquiryStatus } from '@/types/database';
import { SalesWorkflowBar, ContactGrid } from '@/components/admin/SalesWorkflow';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';
import AdminSplitView from '@/components/admin/AdminSplitView';
import {
  enquiryContact,
  enquiryTypeLabel,
  enquiryStatusBadgeClass,
  formatStatusLabel,
} from '@/lib/admin/sales-workflow';
import { createIdempotencyKey } from '@/lib/client/idempotency-key';

const STATUS_TABS = ['all', 'new', 'contacted', 'converted_to_rfq', 'converted_to_order', 'closed'] as const;

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState('');

  const [responseDraft, setResponseDraft] = useState('');
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseError, setResponseError] = useState('');

  // Products & Line items state
  const [lineItemsDraft, setLineItemsDraft] = useState<Array<{ productId?: string; name?: string; quantity: number }>>([]);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [itemsError, setItemsError] = useState('');

  const [rfqQty, setRfqQty] = useState(1);
  const [rfqProductId, setRfqProductId] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [addCatalogSearch, setAddCatalogSearch] = useState('');
  const [addCatalogProducts, setAddCatalogProducts] = useState<any[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqError, setRfqError] = useState('');
  const [createdRfqId, setCreatedRfqId] = useState('');

  const { isPending, run, lastError, clearError } = useMutation();

  const loadEnquiries = useCallback(async (showLoading = true, opts?: { force?: boolean }) => {
    const url = `/api/enquiries?status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}`;
    const force = Boolean(opts?.force);
    const existing = force ? null : peekPortalCache<{ enquiries: any[]; total: number }>(url);

    if (existing) {
      const list = existing.data.enquiries || [];
      setEnquiries(list);
      setTotal(existing.data.total || 0);
      setLoadError(null);
      setSelectedEnquiry((prev: any) => {
        if (prev) {
          const updated = list.find((e: any) => e.id === prev.id);
          if (updated) {
            return { ...prev, ...updated };
          }
        }
        if (!prev && list[0]) {
          syncDetailForm(list[0]);
          return list[0];
        }
        return prev;
      });
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }

    try {
      const result = await cachedApiGet<{ enquiries: any[]; total: number }>(url, {
        force: force || (showLoading && !existing),
      });
      if (result.ok) {
        const list = result.data.enquiries || [];
        setEnquiries(list);
        setTotal(result.data.total || 0);
        setLoadError(null);
        setSelectedEnquiry((prev: any) => {
          if (prev) {
            const updated = list.find((e: any) => e.id === prev.id);
            if (updated) {
              return { ...prev, ...updated, response_message: updated.response_message };
            }
            return prev;
          }
          if (list[0]) {
            syncDetailForm(list[0]);
            return list[0];
          }
          return prev;
        });
        markPortalContentReady('/admin/enquiries');
      } else {
        if (!existing) {
          setEnquiries([]);
          setTotal(0);
        }
        setLoadError(result.message || 'Failed to load enquiries');
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      if (!peekPortalCache(url)) {
        setEnquiries([]);
        setTotal(0);
      }
      setLoadError('Network error loading enquiries');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page]);

  const enquiryListUrl = useCallback(() => {
    return `/api/enquiries?status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}`;
  }, [statusFilter, debouncedSearch, page]);

  function patchEnquiry(enquiryId: string, patch: Record<string, unknown>) {
    setEnquiries((prev) => {
      const next = prev.map((e) => (e.id === enquiryId ? { ...e, ...patch } : e));
      setPortalCache(enquiryListUrl(), { enquiries: next, total });
      return next;
    });
    setSelectedEnquiry((prev: any) =>
      prev?.id === enquiryId ? { ...prev, ...patch } : prev
    );
  }

  async function refreshEnquiries() {
    invalidatePortalCache('/api/enquiries');
    await loadEnquiries(false, { force: true });
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  // Catalog search for RFQ creation
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

  // Catalog search for adding products to enquiry
  useEffect(() => {
    const q = addCatalogSearch.trim();
    const ac = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/products?mode=admin&limit=50&search=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setAddCatalogProducts(json.data.products || []);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [addCatalogSearch]);

  function syncDetailForm(enq: any) {
    setEditName(enq.guest_name || enq.customer?.full_name || '');
    setEditEmail(enq.guest_email || enq.customer?.email || '');
    setEditPhone(enq.guest_phone || enq.customer?.phone || '');
    setEditCountry(enq.country || '');
    setEditCompany(enq.company_name || '');
    setResponseDraft(enq.response_message || '');

    // Sync line items
    let items: Array<{ productId?: string; name?: string; quantity: number }> = [];
    if (Array.isArray(enq.line_items) && enq.line_items.length > 0) {
      items = enq.line_items.map((li: any) => ({
        productId: li.product_id || li.productId,
        name: li.name || 'Product',
        quantity: Math.max(1, Number(li.quantity) || 1),
      }));
    } else if (enq.product_id || enq.product?.id) {
      items = [{
        productId: enq.product_id || enq.product?.id,
        name: enq.product?.name || 'Product',
        quantity: 1,
      }];
    }
    setLineItemsDraft(items);

    const initialQty = Math.max(1, enq.product?.moq || enq.product?.suggested_moq || 1);
    setRfqQty(initialQty);
    setRfqProductId(enq.product_id || enq.product?.id || '');
    setRfqError('');
    setCreatedRfqId('');
    setContactError('');
    setResponseError('');
    setItemsError('');
  }

  function selectEnquiry(enq: any) {
    setSelectedEnquiry(enq);
    syncDetailForm(enq);
  }

  async function handleUpdateStatus(enquiryId: string, newStatus: EnquiryStatus) {
    const current = enquiries.find((e) => e.id === enquiryId) || selectedEnquiry;
    const oldStatus = current?.status as EnquiryStatus | undefined;
    if (oldStatus === newStatus) return;
    clearError();
    await run(
      () => apiPut(`/api/enquiries/${enquiryId}`, { status: newStatus }),
      {
        key: mutationKey(enquiryId, `status-${newStatus}`),
        optimistic: () => patchEnquiry(enquiryId, { status: newStatus }),
        rollback: () => oldStatus && patchEnquiry(enquiryId, { status: oldStatus }),
        onSuccess: () => {
          patchEnquiry(enquiryId, { status: newStatus });
          void refreshEnquiries();
          notifyDashboardChanged();
        },
      }
    );
  }

  async function handleSaveContact() {
    if (!selectedEnquiry) return;
    setContactSaving(true);
    setContactError('');
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: editName.trim(),
          guestEmail: editEmail.trim(),
          guestPhone: editPhone.trim(),
          country: editCountry.trim(),
          companyName: editCompany.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setContactError(json.error?.message || 'Failed to save contact details');
        return;
      }
      patchEnquiry(selectedEnquiry.id, {
        guest_name: editName.trim(),
        guest_email: editEmail.trim(),
        guest_phone: editPhone.trim(),
        country: editCountry.trim(),
        company_name: editCompany.trim() || null,
      });
      await refreshEnquiries();
    } catch {
      setContactError('Failed to save contact details');
    } finally {
      setContactSaving(false);
    }
  }

  async function handleSaveLineItems() {
    if (!selectedEnquiry) return;
    setItemsSaving(true);
    setItemsError('');
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: lineItemsDraft,
          productId: lineItemsDraft[0]?.productId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setItemsError(json.error?.message || 'Failed to update items');
        return;
      }
      patchEnquiry(selectedEnquiry.id, {
        line_items: lineItemsDraft.length ? lineItemsDraft : null,
        product_id: lineItemsDraft[0]?.productId || null,
      });
      await refreshEnquiries();
    } catch {
      setItemsError('Failed to update line items');
    } finally {
      setItemsSaving(false);
    }
  }

  function handleAddProductToEnquiry() {
    if (!selectedAddProductId) return;
    const prod = addCatalogProducts.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    setLineItemsDraft((prev) => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        quantity: Math.max(1, addQty || prod.moq || 1),
      },
    ]);
    setSelectedAddProductId('');
    setAddQty(1);
  }

  function handleRemoveLineItem(idx: number) {
    setLineItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleUpdateLineQty(idx: number, qty: number) {
    setLineItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  }

  async function handleSaveResponse() {
    if (!selectedEnquiry) return;
    if (!responseDraft.trim()) {
      setResponseError('Enter a response message before saving.');
      return;
    }
    setResponseSaving(true);
    setResponseError('');
    const nextStatus =
      selectedEnquiry.status === 'new' ? ('contacted' as EnquiryStatus) : undefined;
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseMessage: responseDraft.trim(),
          status: nextStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setResponseError(json.error?.message || 'Failed to save response');
        return;
      }
      patchEnquiry(selectedEnquiry.id, {
        response_message: responseDraft.trim(),
        responded_at: new Date().toISOString(),
        ...(nextStatus ? { status: nextStatus } : {}),
      });
      await refreshEnquiries();
      notifyDashboardChanged();
    } catch {
      setResponseError('Failed to save response');
    } finally {
      setResponseSaving(false);
    }
  }

  async function handleCreateRfq() {
    if (!selectedEnquiry) return;
    setRfqError('');

    // Prepare payload
    const hasDraftLines = lineItemsDraft.length > 0;
    const itemsPayload = hasDraftLines
      ? lineItemsDraft
          .filter((li) => Boolean(li.productId))
          .map((li) => ({
            productId: li.productId!,
            quantity: li.quantity,
          }))
      : [];

    const productId = selectedEnquiry.product_id || selectedEnquiry.product?.id || rfqProductId.trim();
    if (!hasDraftLines && !productId) {
      setRfqError('Link or select a product before creating an RFQ.');
      return;
    }

    setRfqLoading(true);
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}/convert-to-rfq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': createIdempotencyKey(),
        },
        body: JSON.stringify({
          items: itemsPayload.length > 0 ? itemsPayload : undefined,
          quantity: itemsPayload.length === 0 ? rfqQty : undefined,
          productId: itemsPayload.length === 0 && !selectedEnquiry.product_id ? productId : undefined,
          deliveryAddress: editCountry.trim()
            ? {
                address_line_1: 'To be confirmed',
                city: 'TBD',
                state: 'TBD',
                postal_code: '000000',
                country: editCountry.trim(),
              }
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRfqError(json.error?.message || 'Failed to create RFQ');
        return;
      }
      setCreatedRfqId(json.data?.rfqId || '');
      patchEnquiry(selectedEnquiry.id, { status: 'converted_to_rfq' });
      await refreshEnquiries();
      notifyDashboardChanged();
    } catch {
      setRfqError('Failed to create RFQ');
    } finally {
      setRfqLoading(false);
    }
  }

  async function handleDeleteEnquiry(enquiryId: string) {
    if (!confirm('Delete this enquiry?')) return;
    const result = await apiDelete(`/api/enquiries/${enquiryId}`);
    if (!result.ok) {
      setLoadError(result.message || 'Failed to delete enquiry');
      return;
    }
    if (selectedEnquiry?.id === enquiryId) setSelectedEnquiry(null);
    setEnquiries((prev) => prev.filter((e) => e.id !== enquiryId));
    setTotal((t) => Math.max(0, t - 1));
    await refreshEnquiries();
    notifyDashboardChanged();
  }

  const contact = selectedEnquiry ? enquiryContact(selectedEnquiry) : null;
  const canCreateRfq =
    selectedEnquiry &&
    !['converted_to_rfq', 'converted_to_order', 'closed'].includes(selectedEnquiry.status);

  return (
    <div className="space-y-4 w-full min-w-0 flex flex-col">
      <AdminPageHeader
        title="Enquiries"
        description="All inbound leads — general help, services, and product enquiries."
        actions={
          <button onClick={() => void refreshEnquiries()} className="saas-btn-secondary gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {loadError ? (
        <div className="rounded-2xl border border-portal-danger/30 bg-portal-danger-soft px-4 py-3 text-sm text-portal-danger flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" className="saas-btn-secondary text-xs" onClick={() => void refreshEnquiries()}>
            Retry
          </button>
        </div>
      ) : null}

      <SalesWorkflowBar active="enquiries" />

      <AdminToolbar>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center w-full">
          <div className="saas-search-field w-full sm:max-w-xs">
            <Search className="saas-search-icon" />
            <input
              type="text"
              placeholder="Search name, email, phone, country…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="saas-input w-full"
            />
          </div>
          <div className="saas-segmented overflow-x-auto flex-nowrap">
            {STATUS_TABS.map((st) => (
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
        scrollable
        listCols={5}
        detailCols={7}
        mobileDetailOpen={!!selectedEnquiry}
        list={
          loadError && enquiries.length === 0 ? (
            <div className="saas-panel p-10 text-center text-sm text-portal-muted">
              Could not load enquiries. Use Retry above.
            </div>
          ) : enquiries.length === 0 ? (
            <div className="saas-panel p-10 text-center text-sm text-portal-muted">No enquiries found.</div>
          ) : (
            enquiries.map((enq) => {
              const c = enquiryContact(enq);
              const isSelected = selectedEnquiry?.id === enq.id;
              return (
                <button
                  key={enq.id}
                  type="button"
                  onClick={() => selectEnquiry(enq)}
                  className={`saas-list-item space-y-1.5 ${isSelected ? 'saas-list-item-selected' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-portal-text truncate">{c.name}</span>
                    <span className={enquiryStatusBadgeClass(enq.status)}>
                      {formatStatusLabel(enq.status)}
                    </span>
                  </div>
                  <div className="text-xs text-portal-muted font-mono">
                    {enquiryTypeLabel(enq.enquiry_type, !!enq.product_id || (Array.isArray(enq.line_items) && enq.line_items.length > 0))} ·{' '}
                    {new Date(enq.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-portal-muted truncate">
                    {enq.product?.name || enq.message?.slice(0, 60) || '—'}
                  </div>
                </button>
              );
            })
          )
        }
        detail={
          selectedEnquiry ? (
            <div className="saas-panel p-5 space-y-4">
              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="lg:hidden saas-btn-ghost text-xs py-1.5 px-2 -ml-1 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to list
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-portal-border pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="type-section">{contact?.name}</h2>
                    <span className={enquiryStatusBadgeClass(selectedEnquiry.status)}>
                      {formatStatusLabel(selectedEnquiry.status)}
                    </span>
                    <span className="saas-badge-neutral text-[10px]">
                      {enquiryTypeLabel(selectedEnquiry.enquiry_type, !!selectedEnquiry.product_id || (Array.isArray(selectedEnquiry.line_items) && selectedEnquiry.line_items.length > 0))}
                    </span>
                  </div>
                  <p className="text-xs text-portal-muted mt-1">
                    Received {new Date(selectedEnquiry.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedEnquiry.status === 'new' && (
                    <button
                      type="button"
                      className="saas-btn-secondary text-xs py-1.5 px-3"
                      disabled={isPending(mutationKey(selectedEnquiry.id, 'status-contacted'))}
                      onClick={() => handleUpdateStatus(selectedEnquiry.id, 'contacted')}
                    >
                      Mark contacted
                    </button>
                  )}
                  {selectedEnquiry.status !== 'closed' &&
                    selectedEnquiry.status !== 'converted_to_order' && (
                    <button
                      type="button"
                      className="saas-btn-secondary text-xs py-1.5 px-3"
                      disabled={isPending(mutationKey(selectedEnquiry.id, 'status-closed'))}
                      onClick={() => handleUpdateStatus(selectedEnquiry.id, 'closed')}
                    >
                      Close
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-portal-muted hover:text-portal-danger"
                    onClick={() => handleDeleteEnquiry(selectedEnquiry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {lastError ? (
                <p className="text-xs text-portal-danger">{lastError}</p>
              ) : null}

              {contact && (
                <ContactGrid
                  name={contact.name}
                  email={contact.email}
                  phone={contact.phone}
                  country={contact.country}
                  company={contact.company}
                />
              )}

              <div className="space-y-2">
                <span className="type-meta text-portal-muted">Correct contact details</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input className="saas-input text-xs" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                  <input className="saas-input text-xs" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Company (optional)" />
                  <input className="saas-input text-xs" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                  <input className="saas-input text-xs" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone" />
                  <input className="saas-input text-xs col-span-2" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} placeholder="Country" />
                </div>
                {contactError && <p className="text-xs text-portal-danger">{contactError}</p>}
                <button type="button" className="saas-btn-secondary text-xs py-1.5 px-3" disabled={contactSaving} onClick={handleSaveContact}>
                  {contactSaving ? 'Saving…' : 'Save contact'}
                </button>
              </div>

              <div>
                <span className="type-meta text-portal-muted">Message</span>
                <div className="text-xs text-portal-text bg-portal-inset p-3 rounded-xl mt-1 whitespace-pre-wrap">
                  {selectedEnquiry.message}
                </div>
              </div>

              {/* Products & Line items manager */}
              <div className="space-y-3 pt-3 border-t border-portal-border">
                <div className="flex items-center justify-between">
                  <span className="type-meta text-portal-muted flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Products & Line Items ({lineItemsDraft.length})
                  </span>
                  {lineItemsDraft.length === 0 && (
                    <span className="text-[11px] text-portal-muted italic">
                      General enquiry (no products)
                    </span>
                  )}
                </div>

                {lineItemsDraft.length > 0 && (
                  <div className="space-y-2">
                    {lineItemsDraft.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 bg-portal-inset p-2.5 rounded-xl text-xs"
                      >
                        <span className="font-medium text-portal-text flex-1 truncate">
                          {item.name || 'Product'}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-portal-muted">Qty:</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                            className="saas-input text-xs w-20 py-1 px-2"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-1 text-portal-muted hover:text-portal-danger rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add product from catalog */}
                <div className="p-3 rounded-xl bg-portal-inset/50 border border-portal-border space-y-2">
                  <span className="text-[11px] font-medium text-portal-text">Add product to enquiry</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      className="saas-input text-xs"
                      placeholder="Search catalog…"
                      value={addCatalogSearch}
                      onChange={(e) => setAddCatalogSearch(e.target.value)}
                    />
                    <select
                      className="saas-input text-xs"
                      value={selectedAddProductId}
                      onChange={(e) => setSelectedAddProductId(e.target.value)}
                    >
                      <option value="">Select product</option>
                      {addCatalogProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (MOQ: {p.moq || 1})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={addQty}
                        onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="saas-input text-xs w-20"
                      />
                      <button
                        type="button"
                        onClick={handleAddProductToEnquiry}
                        disabled={!selectedAddProductId}
                        className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>

                {itemsError && <p className="text-xs text-portal-danger">{itemsError}</p>}
                <button
                  type="button"
                  onClick={handleSaveLineItems}
                  disabled={itemsSaving}
                  className="saas-btn-secondary text-xs py-1.5 px-3"
                >
                  {itemsSaving ? 'Saving…' : 'Save line items'}
                </button>
              </div>

              {selectedEnquiry.attachment_url && (
                <a
                  href={selectedEnquiry.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-portal-text font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View attachment
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <div className="pt-3 border-t border-portal-border space-y-2">
                <span className="type-meta text-portal-muted">Reply to buyer</span>
                <textarea
                  className="saas-input text-xs min-h-[72px]"
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                />
                {responseError && <p className="text-xs text-portal-danger">{responseError}</p>}
                <button type="button" className="saas-btn-secondary text-xs py-1.5 px-3" disabled={responseSaving} onClick={handleSaveResponse}>
                  {responseSaving ? 'Saving…' : 'Save response'}
                </button>
              </div>

              {canCreateRfq && (
                <div className="pt-3 border-t border-portal-border space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="type-meta text-portal-muted">Next step — create RFQ</span>
                    <ArrowRight className="w-3.5 h-3.5 text-portal-muted" />
                  </div>
                  {lineItemsDraft.length === 0 && !selectedEnquiry.product_id && !selectedEnquiry.product?.id && (
                    <>
                      <input
                        className="saas-input text-xs"
                        placeholder="Search catalog…"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                      />
                      <select
                        className="saas-input text-xs"
                        value={rfqProductId}
                        onChange={(e) => setRfqProductId(e.target.value)}
                      >
                        <option value="">Select product</option>
                        {catalogProducts.map((p: { id: string; name: string; moq?: number }) => (
                          <option key={p.id} value={p.id}>{p.name} (MOQ: {p.moq || 1})</option>
                        ))}
                      </select>
                    </>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    {lineItemsDraft.length === 0 && (
                      <div className="space-y-1">
                        <label className="type-meta text-portal-muted">Qty</label>
                        <input
                          type="number"
                          min={1}
                          className="saas-input text-xs w-24"
                          value={rfqQty}
                          onChange={(e) => setRfqQty(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                    )}
                    <button type="button" className="saas-btn-gold text-xs py-2 px-4" disabled={rfqLoading} onClick={handleCreateRfq}>
                      {rfqLoading ? 'Creating…' : lineItemsDraft.length > 1 ? `Create RFQ (${lineItemsDraft.length} items)` : 'Create RFQ'}
                    </button>
                  </div>
                  {rfqError && <p className="text-xs text-portal-danger">{rfqError}</p>}
                  {createdRfqId && (
                    <Link href="/admin/rfqs" className="text-xs text-portal-success underline">
                      RFQ created — open RFQs to negotiate
                    </Link>
                  )}
                </div>
              )}

              {selectedEnquiry.status === 'converted_to_rfq' && (
                <Link href="/admin/rfqs" className="saas-btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5">
                  View in RFQs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              {selectedEnquiry.tracking_token && (
                <button
                  type="button"
                  className="text-[11px] underline text-portal-muted"
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/track/enquiry/${selectedEnquiry.tracking_token}`)
                  }
                >
                  Copy tracking link
                </button>
              )}
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-sm text-portal-muted">
              Select an enquiry to review contact details and actions.
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
    </div>
  );
}
