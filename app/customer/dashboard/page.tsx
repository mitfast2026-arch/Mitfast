'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  ChevronRight,
  Heart,
  ShoppingCart,
  FileText,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cachedApiGet } from '@/lib/client/portal-data-cache';
import { CustomerPageShell, CustomerPageSkeleton } from '@/components/customer/CustomerPageShell';
import { BuyerEmptyState, BuyerStatIcon } from '@/components/customer/BuyerEmptyState';

function statusClass(status?: string) {
  const s = (status || '').toLowerCase();
  if (
    s.includes('deliver') ||
    s.includes('complet') ||
    s.includes('accept') ||
    s === 'quoted'
  ) {
    return 'buyer-chip bg-[#F0FDF4] text-[#15803D]';
  }
  if (s.includes('cancel') || s.includes('reject')) {
    return 'buyer-chip bg-[#FEF2F2] text-[#B91C1C]';
  }
  if (s.includes('dispatch') || s.includes('ship')) {
    return 'buyer-chip bg-[#EEF2FF] text-[#3730A3]';
  }
  if (
    s.includes('pending') ||
    s.includes('review') ||
    s.includes('process') ||
    s.includes('confirm')
  ) {
    return 'buyer-chip bg-[#FEF3C7] text-[#B45309]';
  }
  return 'buyer-chip bg-[#eceef0] text-[#4B5563]';
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentRfqs, setRecentRfqs] = useState<any[]>([]);
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
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
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!prof) {
          router.push('/auth?role=buyer&mode=signin');
          return;
        }

        setProfile(prof);

        const [orderRes, rfqRes, enqRes, badgeRes] = await Promise.all([
          cachedApiGet<{ orders: any[] }>(`/api/orders?customerId=${prof.id}&limit=4`),
          cachedApiGet<{ rfqs: any[] }>(`/api/rfqs?customerId=${prof.id}&limit=4`),
          cachedApiGet<{ enquiries: any[] }>(`/api/customer/enquiries?limit=4`),
          cachedApiGet<{
            orders: number;
            rfqs: number;
            enquiries: number;
            wishlist: number;
            cart: number;
          }>(`/api/customer/badge-counts`),
        ]);

        const errors: string[] = [];
        if (orderRes.ok) {
          setRecentOrders(orderRes.data?.orders || []);
        } else {
          setRecentOrders([]);
          errors.push(orderRes.message || 'Failed to load orders');
        }
        if (rfqRes.ok) {
          setRecentRfqs(rfqRes.data?.rfqs || []);
        } else {
          setRecentRfqs([]);
          errors.push(rfqRes.message || 'Failed to load RFQs');
        }
        if (enqRes.ok) {
          setRecentEnquiries(enqRes.data?.enquiries || []);
        } else {
          setRecentEnquiries([]);
          errors.push(enqRes.message || 'Failed to load enquiries');
        }
        if (badgeRes.ok && badgeRes.data) {
          setWishlistCount(badgeRes.data.wishlist ?? 0);
          setCartCount(badgeRes.data.cart ?? 0);
        }
        setLoadError(errors.length ? errors.join(' · ') : null);
      } catch (err) {
        console.error('Customer dashboard load error:', err);
        setLoadError('Network error loading dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [router]);

  const firstName =
    (profile?.full_name || 'Buyer').split(' ').filter(Boolean)[0] || 'Buyer';

  const quotesCount = recentRfqs.length + recentEnquiries.length;

  const quoteRows = [
    ...recentRfqs.map((rfq: any) => ({
      id: rfq.id,
      title: rfq.rfq_number || 'RFQ',
      meta: `${rfq.items?.length || 1} lines`,
      status: rfq.status,
      href: '/customer/quotes?tab=rfqs',
      at: rfq.created_at ? new Date(rfq.created_at).getTime() : 0,
    })),
    ...recentEnquiries.map((enq: any) => ({
      id: enq.id,
      title: enq.product?.name || enq.subject || 'Enquiry',
      meta: 'Enquiry',
      status: enq.status,
      href: '/customer/quotes?tab=enquiries',
      at: enq.created_at ? new Date(enq.created_at).getTime() : 0,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 4);

  const ordersToShow = recentOrders.slice(0, 4);

  const stats = [
    {
      label: 'Orders',
      value: recentOrders.length,
      href: '/customer/orders',
      icon: Package,
      tone: 'orders' as const,
      grad: 'buyer-stat-card--sky',
    },
    {
      label: 'Cart',
      value: cartCount,
      href: '/cart',
      icon: ShoppingCart,
      tone: 'cart' as const,
      grad: 'buyer-stat-card--warm',
    },
    {
      label: 'Wishlist',
      value: wishlistCount,
      href: '/customer/wishlist',
      icon: Heart,
      tone: 'wishlist' as const,
      grad: 'buyer-stat-card--rose',
    },
    {
      label: 'Quotes',
      value: quotesCount,
      href: '/customer/quotes',
      icon: FileText,
      tone: 'quotes' as const,
      grad: 'buyer-stat-card--mint',
    },
  ];

  if (loading) {
    return <CustomerPageSkeleton blocks={2} compact />;
  }

  return (
    <CustomerPageShell
      compact
      title={`Hello, ${firstName}`}
      subtitle="Orders, quotes, and saved parts — one place."
      actions={
        <>
          <Link href="/products" className="buyer-cta">
            <Boxes className="w-4 h-4" strokeWidth={1.75} />
            Browse catalog
          </Link>
          <Link href="/enquiry" className="buyer-cta-ghost">
            New enquiry
          </Link>
        </>
      }
    >

      {loadError ? (
        <div className="buyer-surface px-4 py-3 text-sm text-[#B91C1C] border border-[#FECACA] bg-[#FEF2F2]">
          {loadError}
        </div>
      ) : null}

      {/* Stats sit on canvas with soft gradient fills */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`buyer-stat-card ${s.grad}`}>
            <BuyerStatIcon icon={s.icon} tone={s.tone} />
            <span className="min-w-0">
              <span className="buyer-stat-value">{s.value}</span>
              <span className="buyer-stat-label">{s.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="buyer-fill-grid">
        {/* Primary: featured gradient panel */}
        <section className="buyer-surface-grad buyer-surface-grad--sky buyer-fill-panel p-6 sm:p-8">
          <div className="buyer-section-head">
            <h2 className="buyer-section-title">
              <span className="buyer-section-icon buyer-section-icon--orders">
                <Package className="w-4 h-4" strokeWidth={1.75} />
              </span>
              Orders
            </h2>
            <Link href="/customer/orders" className="buyer-section-link">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {ordersToShow.length === 0 ? (
            <BuyerEmptyState variant="orders" />
          ) : (
            <ul className="flex-1">
              {ordersToShow.map((order: any) => (
                <li key={order.id}>
                  <Link href="/customer/orders" className="buyer-list-row">
                    <div className="min-w-0">
                      <div className="buyer-list-primary font-mono truncate">
                        {order.order_number}
                      </div>
                      <div className="buyer-list-meta">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                        {order.total != null
                          ? ` · ₹${order.total.toLocaleString('en-IN')}`
                          : ''}
                      </div>
                    </div>
                    <span className={statusClass(order.status)}>
                      {(order.status || 'processing').replace(/_/g, ' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Secondary: open on canvas (no panel) */}
        <section className="buyer-flush buyer-fill-panel px-1 sm:px-2">
          <div className="buyer-section-head">
            <h2 className="buyer-section-title">
              <span className="buyer-section-icon buyer-section-icon--quotes">
                <FileText className="w-4 h-4" strokeWidth={1.75} />
              </span>
              Quotes / RFQs
            </h2>
            <Link href="/customer/quotes" className="buyer-section-link">
              All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {quoteRows.length === 0 ? (
            <BuyerEmptyState variant="quotes" />
          ) : (
            <ul className="flex-1">
              {quoteRows.map((row) => (
                <li key={row.id}>
                  <Link href={row.href} className="buyer-list-row">
                    <div className="min-w-0">
                      <div className="buyer-list-primary truncate">{row.title}</div>
                      <div className="buyer-list-meta">{row.meta}</div>
                    </div>
                    <span className={statusClass(row.status)}>
                      {(row.status || 'open').replace(/_/g, ' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CustomerPageShell>
  );
}
