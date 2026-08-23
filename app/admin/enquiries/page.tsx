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
} from 'lucide-react';
import { apiPut, apiPost, apiDelete } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
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

const STATUS_TABS = ['all', 'new', 'contacted', 'converted_to_rfq', 'converted_to_order', 'closed'] as const;

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const [rfqQty, setRfqQty] = useState(1);
  const [rfqProductId, setRfqProductId] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqError, setRfqError] = useState('');
  const [createdRfqId, setCreatedRfqId] = useState('');

  const { isPending, run } = useMutation();

  const loadEnquiries = useCallback(async (showLoading = true) => {
    const url = `/api/enquiries?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}`;
    const existing = peekPortalCache<{ enquiries: any[]; total: number }>(url);
    if (existing) {
      const list = existing.data.enquiries || [];
      setEnquiries(list);
      setTotal(existing.data.total || 0);
      setSelectedEnquiry((prev: any) => {
        if (prev) {
          const updated = list.find((e: any) => e.id === prev.id);
          if (updated) {
            syncDetailForm(updated);
            return updated;
          }
        }
        if (list[0]) {
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
        force: showLoading && !existing,
      });
      if (result.ok) {
        const list = result.data.enquiries || [];
        setEnquiries(list);
        setTotal(result.data.total || 0);
        setSelectedEnquiry((prev: any) => {
          if (prev) {
            const updated = list.find((e: any) => e.id === prev.id);
            if (updated) {
              syncDetailForm(updated);
              return updated;
            }
          }
          if (list[0]) {
            syncDetailForm(list[0]);
            return list[0];
          }
          return prev;
        });
        markPortalContentReady('/admin/enquiries');
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, page]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  useEffect(() => {
    const q = catalogSearch.trim();
    fetch(`/api/products?mode=admin&limit=50&search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCatalogProducts(json.data.products || []);
      })
      .catch(() => {});
  }, [catalogSearch]);

  function syncDetailForm(enq: any) {
    setEditName(enq.guest_name || enq.customer?.full_name || '');
    setEditEmail(enq.guest_email || enq.customer?.email || '');
    setEditPhone(enq.guest_phone || enq.customer?.phone || '');
    setEditCountry(enq.country || '');
    setEditCompany(enq.company_name || '');
    setResponseDraft(enq.response_message || '');
    setRfqQty(1);
    setRfqProductId(enq.product_id || enq.product?.id || '');
    setRfqError('');
    setCreatedRfqId('');
    setContactError('');
    setResponseError('');
  }

  function selectEnquiry(enq: any) {
    setSelectedEnquiry(enq);
    syncDetailForm(enq);
  }

  async function handleUpdateStatus(enquiryId: string, newStatus: EnquiryStatus) {
    await run(
      () => apiPut(`/api/enquiries/${enquiryId}`, { status: newStatus }),
      {
        key: mutationKey(enquiryId, `status-${newStatus}`),
        onSuccess: () => {
          loadEnquiries(false);
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
      loadEnquiries(false);
    } catch {
      setContactError('Failed to save contact details');
    } finally {
      setContactSaving(false);
    }
  }

  async function handleSaveResponse() {
    if (!selectedEnquiry) return;
    if (!responseDraft.trim()) {
      setResponseError('Enter a response message before saving.');
      return;
    }
    setResponseSaving(true);
    setResponseError('');
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseMessage: responseDraft.trim(),
          status: selectedEnquiry.status === 'new' ? 'contacted' : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setResponseError(json.error?.message || 'Failed to save response');
        return;
      }
      loadEnquiries(false);
    } catch {
      setResponseError('Failed to save response');
    } finally {
      setResponseSaving(false);
    }
  }

  async function handleCreateRfq() {
    if (!selectedEnquiry) return;
    const productId = selectedEnquiry.product_id || selectedEnquiry.product?.id || rfqProductId.trim();
    setRfqError('');
    if (!productId) {
      setRfqError('Link or select a product before creating an RFQ.');
      return;
    }
    setRfqLoading(true);
    try {
      const res = await fetch(`/api/enquiries/${selectedEnquiry.id}/convert-to-rfq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: rfqQty,
          productId: selectedEnquiry.product_id ? undefined : productId,
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
      loadEnquiries(false);
      notifyDashboardChanged();
    } catch {
      setRfqError('Failed to create RFQ');
    } finally {
      setRfqLoading(false);
    }
  }

  async function handleDeleteEnquiry(enquiryId: string) {
    if (!confirm('Delete this enquiry?')) return;
    try {
      await apiDelete(`/api/enquiries/${enquiryId}`);
      if (selectedEnquiry?.id === enquiryId) setSelectedEnquiry(null);
      loadEnquiries(false);
    } catch (err) {
      console.error('Delete enquiry error:', err);
    }
  }

  const contact = selectedEnquiry ? enquiryContact(selectedEnquiry) : null;
  const canCreateRfq =
    selectedEnquiry &&
    !['converted_to_rfq', 'converted_to_order', 'closed'].includes(selectedEnquiry.status);

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="Enquiries"
        description="All inbound leads — contact us, product enquiries, and send-enquiry requests."
        actions={
          <button onClick={() => loadEnquiries()} className="saas-btn-secondary gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

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
        listCols={5}
        detailCols={7}
        list={
          enquiries.length === 0 ? (
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
                    {enquiryTypeLabel(enq.enquiry_type, !!enq.product_id)} ·{' '}
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
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-portal-border pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="type-section">{contact?.name}</h2>
                    <span className={enquiryStatusBadgeClass(selectedEnquiry.status)}>
                      {formatStatusLabel(selectedEnquiry.status)}
                    </span>
                    <span className="saas-badge-neutral text-[10px]">
                      {enquiryTypeLabel(selectedEnquiry.enquiry_type, !!selectedEnquiry.product_id)}
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
                  {selectedEnquiry.status !== 'closed' && selectedEnquiry.status !== 'converted_to_order' && (
                    <button
                      type="button"
                      className="saas-btn-secondary text-xs py-1.5 px-3"
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
                <span className="type-meta text-portal-muted">Product / subject</span>
                <div className="text-sm font-medium text-portal-text mt-0.5">
                  {selectedEnquiry.product?.name || 'General enquiry'}
                </div>
              </div>

              <div>
                <span className="type-meta text-portal-muted">Message</span>
                <div className="text-xs text-portal-text bg-portal-inset p-3 rounded-xl mt-1 whitespace-pre-wrap">
                  {selectedEnquiry.message}
                </div>
              </div>

              {Array.isArray(selectedEnquiry.line_items) &&
                selectedEnquiry.line_items.length > 0 && (
                  <div>
                    <span className="type-meta text-portal-muted">Cart lines</span>
                    <ul className="mt-1 space-y-1 text-xs text-portal-text">
                      {selectedEnquiry.line_items.map(
                        (
                          line: {
                            product_id?: string;
                            name?: string | null;
                            quantity?: number;
                          },
                          idx: number,
                        ) => (
                          <li
                            key={line.product_id || idx}
                            className="flex justify-between gap-2 bg-portal-inset px-3 py-2 rounded-lg"
                          >
                            <span>{line.name || line.product_id || 'Product'}</span>
                            <span className="font-mono text-portal-muted">
                              × {line.quantity ?? 1}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

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
                  {!selectedEnquiry.product_id && !selectedEnquiry.product?.id && (
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
                        {catalogProducts.map((p: { id: string; name: string }) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
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
                    <button type="button" className="saas-btn-gold text-xs py-2 px-4" disabled={rfqLoading} onClick={handleCreateRfq}>
                      {rfqLoading ? 'Creating…' : 'Create RFQ'}
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
    </div>
  );
}
