'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, FileText, Package, ShieldCheck } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [recentRfqs, setRecentRfqs] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCustomerData() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

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

      const [rfqRes, orderRes] = await Promise.all([
        fetch(`/api/rfqs?customerId=${prof.id}`),
        fetch(`/api/orders?customerId=${prof.id}`),
      ]);

      if (rfqRes.ok) {
        const json = await rfqRes.json();
        if (json.success) setRecentRfqs(json.data.rfqs || []);
      }

      if (orderRes.ok) {
        const json = await orderRes.json();
        if (json.success) setRecentOrders(json.data.orders || []);
      }
    } catch (err) {
      console.error('Customer dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomerData();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-[#ECEEF0] rounded-full" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="saas-kpi-card h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Welcome, {profile?.full_name || 'Procurement officer'}</h1>
          <p className="type-subtitle">{profile?.email} • {profile?.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products" className="saas-btn-primary gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Browse catalog
          </Link>
          <Link href="/cart" className="saas-btn-secondary gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />
            RFQ workspace
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/customer/rfqs" className="saas-kpi-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="type-kpi-label">Active RFQs</span>
            <span className="saas-icon-well h-8 w-8">
              <FileText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="type-kpi text-2xl sm:text-3xl">{recentRfqs.length}</div>
          <div className="type-kpi-meta">View quotations</div>
        </Link>

        <Link href="/customer/orders" className="saas-kpi-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="type-kpi-label">Active production orders</span>
            <span className="saas-icon-well h-8 w-8">
              <ShoppingCart className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="type-kpi text-2xl sm:text-3xl">{recentOrders.length}</div>
          <div className="type-kpi-meta">Track fulfillment</div>
        </Link>

        <div className="saas-kpi-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="type-kpi-label">QA inspection</span>
            <span className="saas-icon-well h-8 w-8">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-sm font-semibold text-[#111315]">100% quality inspected</div>
          <div className="type-kpi-meta">Batches backed by CMM reports</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="saas-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="type-section">Recent quotation requests</h2>
            <Link href="/customer/rfqs" className="text-xs text-[#6B7280] hover:text-[#111315]">View all</Link>
          </div>
          {recentRfqs.length === 0 ? (
            <div className="py-8 text-center type-empty-body">No RFQs submitted yet.</div>
          ) : (
            <div className="space-y-2">
              {recentRfqs.slice(0, 4).map((r) => (
                <div key={r.id} className="saas-inset-surface p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-[#111315] font-mono">{r.rfq_number}</div>
                    <div className="text-[#6B7280]">{r.items?.length || 0} line items</div>
                  </div>
                  <div className="text-right">
                    <span className="saas-badge-neutral">{r.status}</span>
                    <div className="type-metric mt-1">₹{(r.final_total ?? r.original_total)?.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="saas-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="type-section">Production orders</h2>
            <Link href="/customer/orders" className="text-xs text-[#6B7280] hover:text-[#111315]">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center type-empty-body">No production orders active.</div>
          ) : (
            <div className="space-y-2">
              {recentOrders.slice(0, 4).map((o) => (
                <div key={o.id} className="saas-inset-surface p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-[#111315] font-mono">{o.order_number}</div>
                    <div className="text-[#6B7280]">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <span className="saas-badge-neutral">{o.status}</span>
                    <div className="type-metric mt-1">₹{o.total?.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
