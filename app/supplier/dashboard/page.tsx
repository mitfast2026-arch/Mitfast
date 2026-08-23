'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Eye, Mail, FileText, ShoppingCart, Package, RefreshCw, Plus } from 'lucide-react';
import { useSupplier } from '@/components/portal/SupplierContext';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { HeroKpiCard, KpiCard, EmptyState, SkeletonCard } from '@/components/portal/ds';

export default function SupplierDashboardPage() {
  const { supplier, loading: supplierLoading } = useSupplier();
  const statsUrl = supplier?.id ? `/api/suppliers/${supplier.id}/stats` : null;
  const cached = statsUrl ? peekPortalCache<any>(statsUrl) : null;
  const [stats, setStats] = useState<any>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);

  const loadData = useCallback(async () => {
    if (!supplier?.id) {
      setLoading(false);
      return;
    }
    const url = `/api/suppliers/${supplier.id}/stats`;
    const existing = peekPortalCache<any>(url);
    if (existing) {
      setStats(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const result = await cachedApiGet<any>(url, { force: !existing });
      if (result.ok) {
        setStats(result.data);
        markPortalContentReady('/supplier/dashboard');
      }
    } catch (err) {
      console.error('Failed to load supplier dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [supplier?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = stats?.summary || {};
  const products = stats?.products || [];
  const showSkeleton = (supplierLoading || loading) && !stats;

  return (
    <div className="space-y-8 w-full">
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
          <button
            type="button"
            onClick={() => void loadData()}
            className="saas-btn-ghost"
            title="Refresh"
            aria-label="Refresh dashboard"
          >
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
              <span className="saas-icon-well group-hover:bg-portal-hover transition-colors">
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-portal-muted">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {showSkeleton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <HeroKpiCard
            label="Product views"
            value={summary.totalViews || 0}
            subtext="Catalog impressions"
            icon={Eye}
            href="/supplier/product-views"
          />
          <KpiCard
            label="Enquiries"
            value={summary.totalEnquiries || 0}
            subtext="CAD & drawing leads"
            icon={Mail}
          />
          <KpiCard
            label="Volume RFQs"
            value={summary.totalRfqs || 0}
            subtext="Quotation requests"
            icon={FileText}
          />
          <KpiCard
            label="Production orders"
            value={summary.totalOrders || 0}
            subtext="Fulfilled shipments"
            icon={ShoppingCart}
          />
        </div>
      )}

      <div className="saas-panel p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">Component performance</h3>
          </div>
          <span className="type-meta bg-portal-inset px-2.5 py-1 rounded-full border border-portal-border">
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
                  <td colSpan={5}>
                    <EmptyState label="No component statistics recorded yet." />
                  </td>
                </tr>
              ) : (
                products.map((item: any) => (
                  <tr key={item.productId}>
                    <td className="font-medium" title={item.productName}>
                      <span className="truncate block max-w-xs">{item.productName}</span>
                    </td>
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
