'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  Package,
  FileText,
  ShieldCheck,
  Clock,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cachedApiGet } from '@/lib/client/portal-data-cache';
import { CustomerPageShell } from '@/components/customer/CustomerPageShell';
import { BuyerEmptyState } from '@/components/customer/BuyerEmptyState';

interface NotificationItem {
  id: string;
  type: 'order' | 'rfq' | 'security' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'order' | 'rfq' | 'security'>('all');

  async function loadNotifications() {
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
        .select('id, full_name, created_at')
        .eq('user_id', user.id)
        .single();

      if (prof) {
        // Fetch recent RFQs and Orders to synthesize dynamic live notifications
        const [rfqRes, orderRes] = await Promise.all([
          cachedApiGet<{ rfqs: any[] }>(`/api/rfqs?customerId=${prof.id}`),
          cachedApiGet<{ orders: any[] }>(`/api/orders?customerId=${prof.id}`),
        ]);

        const notifs: NotificationItem[] = [];

        // Add welcome notification
        notifs.push({
          id: 'welcome',
          type: 'security',
          title: 'Account Verified as B2B Buyer',
          message: `Welcome to MITFAST, ${prof.full_name || 'Partner'}. Your buyer account is active with ISO 17025 compliance support.`,
          timestamp: prof.created_at || new Date().toISOString(),
          read: true,
        });

        // Add live RFQ notifications
        if (rfqRes.ok && rfqRes.data?.rfqs) {
          rfqRes.data.rfqs.forEach((r: any) => {
            notifs.push({
              id: `rfq-${r.id}`,
              type: 'rfq',
              title: `Quotation Update: ${r.rfq_number}`,
              message: `Your RFQ status is currently "${r.status?.replace(/_/g, ' ')}". Total evaluated quote value is ₹${(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}.`,
              timestamp: r.updated_at || r.created_at,
              read: r.status === 'converted_to_order',
              link: '/customer/quotes?tab=rfqs',
            });
          });
        }

        // Add live Order notifications
        if (orderRes.ok && orderRes.data?.orders) {
          orderRes.data.orders.forEach((o: any) => {
            notifs.push({
              id: `order-${o.id}`,
              type: 'order',
              title: `Batch Order: ${o.order_number}`,
              message: `Order status is "${o.status?.replace(/_/g, ' ')}" with payment "${o.payment_status?.replace(/_/g, ' ')}".`,
              timestamp: o.updated_at || o.created_at,
              read: ['dispatched', 'completed', 'delivered'].includes(
                (o.status || '').toLowerCase()
              ),
              link: '/customer/orders',
            });
          });
        }

        // Sort by timestamp desc
        notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(notifs);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [router]);

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const filtered = notifications.filter(
    (n) => filter === 'all' || n.type === filter
  );

  return (
    <CustomerPageShell
      title="Notifications"
      subtitle="Order and quote updates."
      actions={
        <>
          <button type="button" onClick={markAllAsRead} className="buyer-cta-ghost">
            Mark all read
          </button>
          <button type="button" onClick={loadNotifications} className="buyer-cta-ghost" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </>
      }
    >

      <div className="buyer-flush flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'order', label: 'Orders' },
          { key: 'rfq', label: 'RFQs' },
          { key: 'security', label: 'Account' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === t.key
                ? 'bg-[#111315] text-white'
                : 'bg-[#F7F7F8] border border-[#D9DCE1] text-[#6B7280] hover:text-[#111315]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="buyer-surface h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="buyer-flush">
          <BuyerEmptyState
            variant="notifications"
            description="You are all caught up."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif, idx) => {
            const Icon =
              notif.type === 'order'
                ? Package
                : notif.type === 'rfq'
                  ? FileText
                  : notif.type === 'security'
                    ? ShieldCheck
                    : Info;

            const iconBg =
              notif.type === 'order'
                ? 'bg-[#EEF2FF] text-[#1D4ED8]'
                : notif.type === 'rfq'
                  ? 'bg-[#FEF6E7] text-[#B45309]'
                  : notif.type === 'security'
                    ? 'bg-[#E8F5EC] text-[#15803D]'
                    : 'bg-[#E8EAED] text-[#111315]';

            return (
              <div
                key={notif.id}
                className={`p-5 flex items-start gap-4 ${
                  idx === 0
                    ? 'buyer-surface-grad buyer-surface-grad--sky'
                    : 'buyer-surface'
                } ${notif.read ? '' : ''}`}
              >
                <div
                  className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[#111315]">{notif.title}</h3>
                    <span className="text-[11px] text-[#9CA3AF] font-mono">
                      {new Date(notif.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">{notif.message}</p>
                  {notif.link ? (
                    <Link
                      href={notif.link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#111315] hover:underline pt-1"
                    >
                      View details
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CustomerPageShell>
  );
}
