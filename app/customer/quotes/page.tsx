'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileQuestion,
  RefreshCw,
  FileText,
  ExternalLink,
  Plus,
  MessageSquare,
  ShoppingCart,
  ArrowRight,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { StatusPill } from '@/components/portal/ds';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { cachedApiGet } from '@/lib/client/portal-data-cache';
import { apiPost } from '@/lib/client/api-client';
import { createIdempotencyKey } from '@/lib/client/idempotency-key';
import { CustomerPageShell, CustomerPageSkeleton } from '@/components/customer/CustomerPageShell';
import { BuyerEmptyState } from '@/components/customer/BuyerEmptyState';

type Tab = 'enquiries' | 'rfqs';

function enquiryTone(status?: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = (status || '').toLowerCase();
  if (s.includes('convert')) return 'success';
  if (s.includes('contact')) return 'info';
  if (s === 'new' || s.includes('pending')) return 'warning';
  return 'neutral';
}

function rfqTone(status?: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = (status || '').toLowerCase();
  if (s === 'accepted') return 'success';
  if (s.includes('convert')) return 'info';
  if (s.includes('reject')) return 'danger';
  return 'warning';
}

export default function CustomerQuotesPage() {
  return (
    <React.Suspense
      fallback={<CustomerPageSkeleton blocks={2} />}
    >
      <CustomerQuotesInner />
    </React.Suspense>
  );
}

function CustomerQuotesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(tabParam === 'rfqs' ? 'rfqs' : 'enquiries');

  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam === 'rfqs' || tabParam === 'enquiries') {
      setTab(tabParam);
    }
  }, [tabParam]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth?role=buyer&mode=signin');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!prof) {
        router.push('/auth?role=buyer&mode=signin');
        return;
      }

      const [enqRes, rfqRes] = await Promise.all([
        cachedApiGet<{ enquiries: any[] }>('/api/customer/enquiries'),
        cachedApiGet<{ rfqs: any[] }>(`/api/rfqs?customerId=${prof.id}`),
      ]);

      const errors: string[] = [];
      if (enqRes.ok) {
        setEnquiries(enqRes.data?.enquiries || []);
      } else {
        setEnquiries([]);
        errors.push(enqRes.message || 'Failed to load enquiries');
      }
      if (rfqRes.ok) {
        setRfqs(rfqRes.data?.rfqs || []);
      } else {
        setRfqs([]);
        errors.push(rfqRes.message || 'Failed to load RFQs');
      }
      setLoadError(errors.length ? errors.join(' · ') : null);
    } catch (err) {
      console.error('Failed to load quotes:', err);
      setEnquiries([]);
      setRfqs([]);
      setLoadError('Network error loading quotes');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(`/customer/quotes?tab=${next}`, { scroll: false });
  }

  async function handleConvertToOrder(rfqId: string) {
    setConvertingId(rfqId);
    toast.loading('Converting RFQ to confirmed order...', { id: 'convert-order' });
    try {
      const result = await apiPost(`/api/rfqs/${rfqId}/convert-to-order`, undefined, {
        idempotencyKey: createIdempotencyKey(),
      });
      if (result.ok) {
        toast.success('Order created successfully! Redirecting...', { id: 'convert-order' });
        router.push('/customer/orders');
      } else {
        toast.error(result.message || 'Failed to convert RFQ to order', { id: 'convert-order' });
      }
    } catch (err) {
      toast.error('Network error converting RFQ', { id: 'convert-order' });
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <CustomerPageShell
      title="Quotes / RFQs"
      subtitle="Enquiries and RFQ quotations in one place."
      actions={
        <>
          {tab === 'enquiries' ? (
            <Link href="/enquiry" className="buyer-cta">
              <Plus className="w-3.5 h-3.5" />
              New enquiry
            </Link>
          ) : null}
          <button type="button" onClick={loadAll} className="buyer-cta-ghost">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </>
      }
    >

      {/* Tabs open on canvas */}
      <div className="buyer-flush">
        <div className="inline-flex p-1 rounded-full bg-white/80 shadow-[var(--buyer-shadow-sm)]">
          <button
            type="button"
            onClick={() => selectTab('enquiries')}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors',
              tab === 'enquiries'
                ? 'bg-[#111315] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#111315]'
            )}
          >
            <Mail className="w-3.5 h-3.5" />
            Enquiries
            {enquiries.length > 0 ? (
              <span
                className={clsx(
                  'min-w-[1.15rem] h-5 px-1 rounded-full text-[10px] font-mono flex items-center justify-center',
                  tab === 'enquiries' ? 'bg-white/20' : 'bg-[#111315]/10 text-[#111315]'
                )}
              >
                {enquiries.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => selectTab('rfqs')}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors',
              tab === 'rfqs'
                ? 'bg-[#111315] text-white shadow-sm'
                : 'text-[#6B7280] hover:text-[#111315]'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            RFQs
            {rfqs.length > 0 ? (
              <span
                className={clsx(
                  'min-w-[1.15rem] h-5 px-1 rounded-full text-[10px] font-mono flex items-center justify-center',
                  tab === 'rfqs' ? 'bg-white/20' : 'bg-[#111315]/10 text-[#111315]'
                )}
              >
                {rfqs.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="buyer-surface px-4 py-3 text-sm text-[#B91C1C] flex items-center justify-between gap-3 border border-[#FECACA] bg-[#FEF2F2]">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </span>
          <button type="button" onClick={loadAll} className="buyer-cta-ghost text-xs shrink-0">
            Retry
          </button>
        </div>
      ) : null}

      {tab === 'enquiries' ? (
        <div className="space-y-3">
          {loading ? (
            <div className="buyer-surface p-12 text-center text-sm text-[#6B7280]">
              Loading enquiries…
            </div>
          ) : loadError && enquiries.length === 0 ? (
            <div className="buyer-surface p-12 text-center text-sm text-[#6B7280]">
              Could not load enquiries. Use Retry above.
            </div>
          ) : enquiries.length === 0 ? (
            <div className="buyer-flush">
              <BuyerEmptyState variant="enquiries" />
            </div>
          ) : (
            enquiries.map((enq, idx) => (
              <div
                key={enq.id}
                className={
                  idx === 0
                    ? 'buyer-surface-grad buyer-surface-grad--mint p-5 sm:p-6 space-y-4'
                    : 'buyer-surface p-5 sm:p-6 space-y-4'
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9DCE1] pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-sm text-[#111315]">
                      {enq.product?.name || 'General enquiry'}
                    </span>
                    <StatusPill
                      tone={enquiryTone(enq.status)}
                      label={(enq.status || 'open').replace(/_/g, ' ')}
                    />
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    {new Date(enq.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {enq.message ? (
                    <div className="p-4 rounded-xl bg-[#E8EAED] border border-[#D9DCE1] leading-relaxed">
                      <p className="font-semibold text-[11px] mb-1 text-[#111315]">Requirements</p>
                      <p className="whitespace-pre-wrap text-[#6B7280]">{enq.message}</p>
                    </div>
                  ) : null}

                  {enq.response_message ? (
                    <div className="p-4 rounded-xl border border-[#D9DCE1] bg-[#E8F5EC] text-[#15803D] leading-relaxed space-y-1">
                      <div className="font-bold text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Response
                      </div>
                      <p className="whitespace-pre-wrap text-xs">{enq.response_message}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[#6B7280]">
                    <span>
                      Contact:{' '}
                      <strong className="text-[#111315]">{enq.email || enq.guest_email}</strong>
                      {(enq.phone || enq.guest_phone) && <> · {enq.phone || enq.guest_phone}</>}
                    </span>
                    {(enq.attachment_url || enq.file_url) && (
                      <a
                        href={enq.attachment_url || enq.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111315] hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Attachment
                        <ExternalLink className="w-3 h-3 text-[#6B7280]" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <div className="buyer-surface p-12 text-center text-sm text-[#6B7280]">Loading RFQs…</div>
          ) : loadError && rfqs.length === 0 ? (
            <div className="buyer-surface p-12 text-center text-sm text-[#6B7280]">
              Could not load RFQs. Use Retry above.
            </div>
          ) : rfqs.length === 0 ? (
            <div className="buyer-flush">
              <BuyerEmptyState variant="rfqs" />
            </div>
          ) : (
            rfqs.map((r, idx) => (
              <div
                key={r.id}
                className={
                  idx === 0
                    ? 'buyer-surface-grad buyer-surface-grad--warm p-5 sm:p-6 space-y-4'
                    : 'buyer-surface p-5 sm:p-6 space-y-4'
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9DCE1] pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-base text-[#111315]">
                      {r.rfq_number}
                    </span>
                    <StatusPill
                      tone={rfqTone(r.status)}
                      label={(r.status || '').replace(/_/g, ' ')}
                    />
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                {r.status === 'rejected' && r.rejection_reason ? (
                  <div className="text-xs text-[#B91C1C] bg-[#FDECEC] p-3.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{r.rejection_reason}</span>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-[#D9DCE1] bg-[#F7F7F8]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-xs font-medium text-[#6B7280]">Component</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[#6B7280] text-center">
                          Qty
                        </th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[#6B7280] text-right">
                          Unit
                        </th>
                        <th className="px-4 py-2.5 text-xs font-medium text-[#6B7280] text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items?.map((itm: any) => {
                        const finalPrice = itm.final_unit_price ?? itm.original_unit_price;
                        const lineTotal =
                          (itm.final_quantity ?? itm.original_quantity) * finalPrice;
                        return (
                          <tr key={itm.id} className="border-t border-[#D9DCE1]">
                            <td className="px-4 py-3 font-semibold">{itm.product_name_snapshot}</td>
                            <td className="px-4 py-3 text-center font-mono">
                              {itm.final_quantity ?? itm.original_quantity}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              ₹{finalPrice?.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-[#D9DCE1]">
                  <div className="text-xs text-[#6B7280]">
                    Ship to:{' '}
                    <strong className="text-[#111315]">
                      {r.delivery_address_snapshot?.city || 'India'}
                      {r.delivery_address_snapshot?.state
                        ? `, ${r.delivery_address_snapshot.state}`
                        : ''}
                    </strong>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                        Total
                      </span>
                      <span className="text-lg font-bold font-mono text-[#111315]">
                        ₹{(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {r.status === 'accepted' ? (
                      <button
                        type="button"
                        onClick={() => handleConvertToOrder(r.id)}
                        disabled={convertingId === r.id}
                        className="buyer-cta text-xs !bg-[#15803D]"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {convertingId === r.id ? 'Confirming…' : 'Place order'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                    {r.status === 'converted_to_order' ? (
                      <Link href="/customer/orders" className="buyer-cta-ghost text-xs">
                        Track order
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </CustomerPageShell>
  );
}
