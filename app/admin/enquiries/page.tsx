'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  FileText, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  X, 
  Phone, 
  User, 
  Building2
} from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import type { EnquiryStatus } from '@/types/database';

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<any>(null);
  const [convertQty, setConvertQty] = useState(1);
  const [convertPrice, setConvertPrice] = useState('');
  const [convertProductId, setConvertProductId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [convertCountry, setConvertCountry] = useState('India');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [orderTrackingUrl, setOrderTrackingUrl] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [responseDraft, setResponseDraft] = useState('');
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseError, setResponseError] = useState('');
  const { isPending, run } = useMutation();

  async function loadEnquiries(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{ enquiries: any[]; total: number }>(
        `/api/enquiries?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=50`
      );
      if (result.ok) {
        setEnquiries(result.data.enquiries || []);
        setTotal(result.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadEnquiries();
  }, [statusFilter, searchTerm, page]);

  useEffect(() => {
    const q = catalogSearch.trim();
    fetch(`/api/products?mode=admin&limit=50&search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCatalogProducts(json.data.products || []);
      })
      .catch(() => {});
  }, [catalogSearch]);

  async function handleUpdateStatus(enquiryId: string, newStatus: EnquiryStatus) {
    await run(
      () => apiPut(`/api/enquiries/${enquiryId}`, { status: newStatus }),
      {
        key: mutationKey(enquiryId, `status-${newStatus}`),
        onSuccess: () => {
          setEnquiries((prev) =>
            prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus } : e))
          );
          if (selectedEnquiry?.id === enquiryId) {
            setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
          }
        },
      }
    );
  }

  function openEnquiry(enq: any) {
    setSelectedEnquiry(enq);
    setConvertError('');
    setResponseError('');
    setResponseDraft(enq.response_message || '');
    setConvertQty(1);
    const linkedProduct = enq.product;
    setConvertPrice(
      linkedProduct?.selling_price != null ? String(linkedProduct.selling_price) : '',
    );
    setConvertProductId(enq.product_id || enq.product?.id || '');
    setAddr1('');
    setAddr2('');
    setCity('');
    setStateName('');
    setPostalCode('');
    setConvertCountry('India');
    setOrderTrackingUrl('');
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
      setSelectedEnquiry({
        ...selectedEnquiry,
        response_message: responseDraft.trim(),
        responded_at: new Date().toISOString(),
        status: selectedEnquiry.status === 'new' ? 'contacted' : selectedEnquiry.status,
      });
      loadEnquiries();
    } catch (err) {
      console.error('Save enquiry response error:', err);
      setResponseError('Failed to save response');
    } finally {
      setResponseSaving(false);
    }
  }

  async function handleConvertToOrder() {
    if (!selectedEnquiry) return;
    const customerId = selectedEnquiry.customer_id || selectedEnquiry.customer?.id;
    const enquiryProductId = selectedEnquiry.product_id || selectedEnquiry.product?.id;
    const productId = enquiryProductId || convertProductId.trim();
    setConvertError('');

    if (!productId) {
      setConvertError('A product is required to convert this enquiry to an order.');
      return;
    }

    if (!addr1.trim() || !city.trim() || !stateName.trim() || !postalCode.trim()) {
      setConvertError('Delivery address line 1, city, state, and postal code are required.');
      return;
    }

    setConvertLoading(true);
    try {
      const payload: Record<string, unknown> = {
        enquiryId: selectedEnquiry.id,
        quantity: convertQty,
        deliveryAddress: {
          address_line_1: addr1.trim(),
          address_line_2: addr2.trim() || null,
          city: city.trim(),
          state: stateName.trim(),
          postal_code: postalCode.trim(),
          country: convertCountry.trim() || 'India',
        },
      };

      if (customerId) payload.customerId = customerId;
      if (!enquiryProductId && convertProductId.trim()) {
        payload.productId = convertProductId.trim();
      }

      const res = await fetch('/api/orders/from-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setConvertError(json.error?.message || 'Failed to convert enquiry to order');
        return;
      }
      setSelectedEnquiry({ ...selectedEnquiry, status: 'converted_to_order' });
      if (json.data?.trackingToken) {
        setOrderTrackingUrl(`${window.location.origin}/track/${json.data.trackingToken}`);
      }
      loadEnquiries();
    } catch (err) {
      console.error('Convert enquiry error:', err);
      setConvertError('Failed to convert enquiry to order');
    } finally {
      setConvertLoading(false);
    }
  }

  async function handleDeleteEnquiry(enquiryId: string) {
    if (!confirm('Are you sure you want to delete this enquiry?')) return;
    try {
      await fetch(`/api/enquiries/${enquiryId}`, { method: 'DELETE' });
      if (selectedEnquiry?.id === enquiryId) setSelectedEnquiry(null);
      loadEnquiries();
    } catch (err) {
      console.error('Delete enquiry error:', err);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Enquiries
          </h1>
          <p className="type-subtitle">
            Manage product enquiries, custom drawing submissions, and buyer leads.
          </p>
        </div>

        <button 
          onClick={() => loadEnquiries()} 
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="saas-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input 
            type="text"
            placeholder="Search enquiries by name, company, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input pl-9 text-xs"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        </div>

        {/* Status Filter Tabs */}
        <div className="saas-segmented flex-wrap self-start sm:self-auto">
          {['all', 'new', 'contacted', 'converted_to_order', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={statusFilter === st ? 'saas-tab-active' : 'saas-tab-inactive'}
            >
              {st.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name & company</th>
              <th>Contact</th>
              <th>Product / subject</th>
              <th>Status</th>
              <th className="text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#6B7280] text-xs">
                  No enquiries found matching your filter.
                </td>
              </tr>
            ) : (
              enquiries.map((enq) => (
                <tr key={enq.id}>
                  <td className="text-[#6B7280] text-xs">
                    {new Date(enq.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="font-medium text-[#111315]">{enq.full_name || enq.guest_name}</div>
                    {enq.company_name && (
                      <div className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-[#6B7280]" />
                        <span>{enq.company_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-[#6B7280] space-y-0.5">
                    <div>{enq.email || enq.guest_email}</div>
                    <div className="text-[#6B7280]">{enq.phone || enq.guest_phone}</div>
                  </td>
                  <td>
                    <div className="font-medium text-[#111315] text-xs truncate max-w-xs">
                      {enq.product?.name || 'Custom Drawing Enquiry'}
                    </div>
                    {enq.file_url && (
                      <a 
                        href={enq.file_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-[#111315] hover:underline flex items-center gap-1 mt-0.5 font-medium"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View Attachment</span>
                      </a>
                    )}
                  </td>
                  <td>
                    <span className={
                      enq.status === 'new'
                        ? 'saas-badge-cyan'
                        : enq.status === 'converted_to_order'
                        ? 'saas-badge-success'
                        : 'saas-badge-neutral'
                    }>
                      {enq.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right space-x-1.5">
                    <button
                      onClick={() => openEnquiry(enq)}
                      className="saas-btn-secondary text-xs py-1 px-2.5"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteEnquiry(enq.id)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                      title="Delete Enquiry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Enquiry Detail Modal */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <h3 className="text-base text-[#111315]">
                Enquiry Details
              </h3>
              <button 
                onClick={() => setSelectedEnquiry(null)}
                className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F7F7F8] p-3 rounded-xl">
                <div>
                  <span className="type-meta text-[#6B7280]">Name</span>
                  <div className="font-medium text-[#111315]">{selectedEnquiry.full_name || selectedEnquiry.guest_name}</div>
                </div>
                <div>
                  <span className="type-meta text-[#6B7280]">Company</span>
                  <div className="text-[#111315]">{selectedEnquiry.company_name || 'N/A'}</div>
                </div>
                <div>
                  <span className="type-meta text-[#6B7280]">Email</span>
                  <div className="text-[#111315] truncate">{selectedEnquiry.email || selectedEnquiry.guest_email}</div>
                </div>
                <div>
                  <span className="type-meta text-[#6B7280]">Phone</span>
                  <div className="text-[#111315]">{selectedEnquiry.phone || selectedEnquiry.guest_phone}</div>
                </div>
              </div>

              <div>
                <span className="type-meta text-[#6B7280]">Subject / Product</span>
                <div className="text-[#111315] font-medium mt-0.5">
                  {selectedEnquiry.product?.name || 'Custom Drawing Enquiry'}
                </div>
              </div>

              <div>
                <span className="type-meta text-[#6B7280]">Buyer message</span>
                <div className="text-[#111315] bg-[#F7F7F8] p-3 rounded-xl mt-1 whitespace-pre-wrap leading-relaxed">
                  {selectedEnquiry.message || 'No additional message provided.'}
                </div>
              </div>

              {selectedEnquiry.attachment_url && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#ECEEF0] text-[#111315]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#111315]" />
                    <span>Drawing Attachment</span>
                  </div>
                  <a 
                    href={selectedEnquiry.attachment_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="saas-btn-primary text-xs py-1 px-3 flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Status Updater */}
              <div className="pt-3 border-t border-[#E2E4E8] space-y-2">
                <span className="type-meta text-[#6B7280]">
                  Update status
                </span>
                <div className="saas-segmented flex-wrap">
                  {(['new', 'contacted', 'closed'] as EnquiryStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(selectedEnquiry.id, st)}
                      className={selectedEnquiry.status === st ? 'saas-tab-active' : 'saas-tab-inactive'}
                    >
                      {st.replace(/_/g, ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E4E8] space-y-2">
                <span className="type-meta text-[#6B7280]">Reply to buyer</span>
                <textarea
                  className="saas-input text-xs min-h-[88px]"
                  placeholder="Write a response the buyer can see on tracking and their portal…"
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                />
                {responseError && (
                  <p className="text-xs text-[#B91C1C]">{responseError}</p>
                )}
                {selectedEnquiry.responded_at && (
                  <p className="text-[10px] text-[#6B7280] font-mono">
                    Last replied {new Date(selectedEnquiry.responded_at).toLocaleString()}
                  </p>
                )}
                <button
                  type="button"
                  className="saas-btn-secondary text-xs py-1.5 px-3"
                  disabled={responseSaving}
                  onClick={handleSaveResponse}
                >
                  {responseSaving ? 'Saving…' : 'Save response'}
                </button>
              </div>

              {selectedEnquiry.status !== 'converted_to_order' && (
                <div className="pt-3 border-t border-[#E2E4E8] space-y-3">
                  <span className="type-meta text-[#6B7280]">Convert to production order</span>
                  {!(selectedEnquiry.customer_id || selectedEnquiry.customer?.id) && (
                    <p className="text-xs text-[#6B7280] bg-[#F7F7F8] p-2 rounded-lg">
                      Guest enquiry: converting will create a buyer record from their email and phone.
                    </p>
                  )}
                  {selectedEnquiry.tracking_token && (
                    <button
                      type="button"
                      className="text-xs underline text-[#111315]"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/track/enquiry/${selectedEnquiry.tracking_token}`)}
                    >
                      Copy enquiry tracking link
                    </button>
                  )}
                  <div className="space-y-1">
                    <label className="type-meta text-[#6B7280]">Product</label>
                    {selectedEnquiry.product_id || selectedEnquiry.product?.id ? (
                      <div className="saas-input text-xs bg-[#F7F7F8]">
                        {selectedEnquiry.product?.name || 'Linked product'}
                      </div>
                    ) : (
                      <>
                        <input
                          className="saas-input text-xs mb-1"
                          placeholder="Search catalog…"
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                        />
                        <select
                          className="saas-input text-xs"
                          value={convertProductId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setConvertProductId(id);
                            const found = catalogProducts.find((p: { id: string; selling_price?: number; sellingPrice?: number }) => p.id === id);
                            if (found && (found.selling_price != null || found.sellingPrice != null)) {
                              setConvertPrice(String(found.selling_price ?? found.sellingPrice));
                            }
                          }}
                        >
                          <option value="">Select catalog product</option>
                          {catalogProducts.map((p: { id: string; name: string }) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="type-meta text-[#6B7280]">Qty</label>
                      <input
                        type="number"
                        min={1}
                        className="saas-input text-xs"
                        value={convertQty}
                        onChange={(e) => setConvertQty(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="type-meta text-[#6B7280]">Unit price (₹)</label>
                      <input
                        type="text"
                        readOnly
                        className="saas-input text-xs bg-[#F7F7F8]"
                        value={convertPrice ? `₹ ${convertPrice}` : 'From product catalog'}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="type-meta text-[#6B7280]">Delivery address</label>
                    <input className="saas-input text-xs" placeholder="Address line 1" value={addr1} onChange={(e) => setAddr1(e.target.value)} />
                    <input className="saas-input text-xs" placeholder="Address line 2 (optional)" value={addr2} onChange={(e) => setAddr2(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="saas-input text-xs" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                      <input className="saas-input text-xs" placeholder="State" value={stateName} onChange={(e) => setStateName(e.target.value)} />
                      <input className="saas-input text-xs" placeholder="PIN" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    </div>
                    <input
                      className="saas-input text-xs"
                      placeholder="Country"
                      value={convertCountry}
                      onChange={(e) => setConvertCountry(e.target.value)}
                    />
                  </div>
                  {orderTrackingUrl && (
                    <p className="text-xs text-[#15803D] break-all">
                      Order tracking: {orderTrackingUrl}
                    </p>
                  )}
                  {convertError && (
                    <p className="text-xs text-[#B91C1C]">{convertError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleConvertToOrder}
                    disabled={convertLoading}
                    className="saas-btn-gold text-xs py-2 px-4"
                  >
                    {convertLoading ? 'Converting…' : 'Convert to production order'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E2E4E8]">
              <button 
                onClick={() => setSelectedEnquiry(null)}
                className="saas-btn-secondary text-xs py-2 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
