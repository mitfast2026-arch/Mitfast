'use client';

import React, { useEffect, useState } from 'react';
import {
  FileQuestion,
  RefreshCw,
  Search,
  MessageSquare,
} from 'lucide-react';

export default function SupplierEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [responseDraft, setResponseDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  async function loadEnquiries() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/supplier/enquiries?search=${encodeURIComponent(debouncedSearch)}`,
      );
      const json = await res.json();
      if (json.success) {
        const list = json.data.enquiries || [];
        setEnquiries(list);
        setLoadError(null);
        if (selected) {
          const refreshed = list.find((e: any) => e.id === selected.id);
          if (refreshed) {
            setSelected(refreshed);
            setResponseDraft(refreshed.response_message || '');
          }
        }
      } else {
        setEnquiries([]);
        setLoadError(json.error?.message || 'Failed to load enquiries');
      }
    } catch (err) {
      console.error('Failed to load supplier enquiries:', err);
      setEnquiries([]);
      setLoadError('Network error loading enquiries');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function openEnquiry(enq: any) {
    setSelected(enq);
    setResponseDraft(enq.response_message || '');
    setErrorMsg('');
  }

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!responseDraft.trim()) {
      setErrorMsg('Enter a response before sending.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/supplier/enquiries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryId: selected.id,
          responseMessage: responseDraft.trim(),
          status: 'contacted',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to send response');
        return;
      }
      await loadEnquiries();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to send response');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Product enquiries</h1>
          <p className="type-subtitle">
            Enquiries linked to your catalog products. Reply so buyers can see your response.
          </p>
        </div>
        <button
          onClick={loadEnquiries}
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="saas-panel p-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email, or message…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input pl-8 text-xs"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-portal-muted" />
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-portal-danger/30 bg-portal-danger-soft px-4 py-3 text-sm text-portal-danger flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" className="saas-btn-secondary text-xs" onClick={loadEnquiries}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
          {loading ? (
            <div className="saas-panel p-12 text-center text-xs text-portal-muted">
              Loading enquiries…
            </div>
          ) : loadError && enquiries.length === 0 ? (
            <div className="saas-panel p-12 text-center text-xs text-portal-muted">
              Could not load enquiries. Use Retry above.
            </div>
          ) : enquiries.length === 0 ? (
            <div className="saas-panel p-12 text-center space-y-2">
              <FileQuestion className="w-8 h-8 mx-auto text-portal-muted" />
              <p className="text-xs text-portal-muted">No enquiries for your products yet.</p>
            </div>
          ) : (
            enquiries.map((enq) => {
              const isSelected = selected?.id === enq.id;
              return (
                <button
                  key={enq.id}
                  type="button"
                  onClick={() => openEnquiry(enq)}
                  className={`saas-panel p-4 text-left w-full space-y-2 transition-all ${
                    isSelected ? 'ring-2 ring-amber-500 shadow-md' : 'hover:bg-portal-hover'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-portal-text truncate">
                      {enq.product?.name || 'Product enquiry'}
                    </span>
                    <span className="saas-badge-gold text-[10px]">
                      {String(enq.status).replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-portal-muted truncate">{enq.guest_name}</div>
                  <div className="text-[10px] text-portal-muted font-mono">
                    {new Date(enq.created_at).toLocaleDateString()}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-7">
          {selected ? (
            <div className="saas-panel p-6 space-y-5">
              <div className="space-y-1 border-b border-portal-border pb-4">
                <h2 className="type-section">{selected.product?.name || 'Enquiry'}</h2>
                <p className="text-xs text-portal-muted">
                  {selected.guest_name} · {selected.guest_email} · {selected.guest_phone}
                </p>
              </div>

              <div className="space-y-2">
                <div className="type-meta text-portal-muted">Buyer message</div>
                <p className="text-xs whitespace-pre-wrap text-portal-text">{selected.message}</p>
              </div>

              <form onSubmit={handleRespond} className="space-y-3">
                <div className="type-meta text-portal-muted flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Your response
                </div>
                <textarea
                  className="saas-input text-xs min-h-[100px]"
                  value={responseDraft}
                  onChange={(e) => setResponseDraft(e.target.value)}
                  placeholder="Reply to this buyer…"
                />
                {errorMsg && <p className="text-xs text-portal-danger">{errorMsg}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="saas-btn-primary text-xs py-2 px-4"
                >
                  {saving ? 'Sending…' : 'Send response'}
                </button>
              </form>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-portal-muted">
              Select an enquiry to view details and reply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
