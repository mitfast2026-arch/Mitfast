'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, Mail, FileText, ShoppingCart, Package, RefreshCw, Plus } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SupplierDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth?role=supplier&mode=signin');
        return;
      }

      const { data: sup } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!sup) {
        router.push('/auth?role=supplier&mode=signin');
        return;
      }

      const res = await fetch(`/api/suppliers/${sup.id}/stats`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to load supplier dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [router]);

  const summary = stats?.summary || {};
  const products = stats?.products || [];

  const kpis = [
    { label: 'Product views', value: summary.totalViews || 0, meta: 'Catalog impressions', icon: Eye },
    { label: 'Enquiries', value: summary.totalEnquiries || 0, meta: 'CAD & drawing leads', icon: Mail },
    { label: 'Volume RFQs', value: summary.totalRfqs || 0, meta: 'Quotation requests', icon: FileText },
    { label: 'Production orders', value: summary.totalOrders || 0, meta: 'Fulfilled shipments', icon: ShoppingCart },
  ];

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Supplier dashboard</h1>
          <p className="type-subtitle">Product views, enquiries, RFQs, and orders for your catalog.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/supplier/products" className="saas-btn-primary gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Manage catalog
          </Link>
          <button onClick={loadData} className="saas-btn-ghost" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          { href: '/supplier/products', icon: Plus, label: 'Add product' },
          { href: '/supplier/orders', icon: ShoppingCart, label: 'Production orders' },
          { href: '/supplier/rfqs', icon: FileText, label: 'RFQs' },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 group">
              <span className="saas-icon-well group-hover:bg-[#D7D9DC] transition-colors">
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-[#6B7280]">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="saas-kpi-card p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="type-kpi-label">{kpi.label}</span>
                <span className="saas-icon-well">
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="type-kpi">{loading ? '—' : kpi.value}</div>
                <div className="type-kpi-meta mt-1.5">{kpi.meta}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="saas-panel p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">Component performance</h3>
          </div>
          <span className="type-meta bg-[#F7F7F8] px-2.5 py-1 rounded-full border border-[#E2E4E8]">
            {products.length} listed
          </span>
        </div>

        <div className="saas-table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Component name</th>
                <th className="text-center">Views</th>
                <th className="text-center">Enquiries</th>
                <th className="text-center">RFQs</th>
                <th className="text-center">Production orders</th>
              </tr>
            </thead>
            <tbody>
              {!products.length ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center type-empty-body">
                    No component statistics recorded yet.
                  </td>
                </tr>
              ) : (
                products.map((item: any) => (
                  <tr key={item.productId}>
                    <td className="font-medium">{item.productName}</td>
                    <td className="text-center type-metric">{item.views}</td>
                    <td className="text-center type-metric">{item.enquiries}</td>
                    <td className="text-center type-metric">{item.rfqs}</td>
                    <td className="text-center type-metric">{item.orders}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
