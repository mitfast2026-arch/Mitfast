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

  const quickLinks = [
    { href: '/supplier/products?action=create', icon: Plus, label: 'Add product' },
    { href: '/supplier/orders', icon: ShoppingCart, label: 'Orders' },
    { href: '/supplier/rfqs', icon: FileText, label: 'RFQs' },
  ];

  return (
    <div className="portal-dashboard w-full max-w-full min-w-0 space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="type-page">Supplier dashboard</h1>
          <p className="type-subtitle mt-0.5">
            Product views, enquiries, RFQs, and orders for your catalog.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="saas-btn-secondary gap-1.5 text-xs px-3 py-1.5"
              >
                <Icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            );
          })}
          <Link href="/supplier/products" className="saas-btn-primary gap-1.5 text-xs px-3 py-1.5">
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

      {showSkeleton ? (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
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
            label="Orders"
            value={summary.totalOrders || 0}
            subtext="Completed orders"
            icon={ShoppingCart}
          />
        </div>
      )}

      <div className="saas-panel p-4 space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-portal-text shrink-0" />
            <h3 className="type-section">Product performance</h3>
          </div>
          <span className="type-meta bg-portal-inset px-2 py-0.5 rounded-full border border-portal-border shrink-0">
            {products.length} listed
          </span>
        </div>

        <div className="saas-table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Product name</th>
                <th className="text-center w-20">Views</th>
                <th className="text-center w-24">Enquiries</th>
                <th className="text-center w-16">RFQs</th>
                <th className="text-center w-28">Orders</th>
              </tr>
            </thead>
            <tbody>
              {!products.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState label="No product statistics recorded yet." className="py-6" />
                  </td>
                </tr>
              ) : (
                products.map((item: any) => (
                  <tr key={item.productId}>
                    <td className="font-medium max-w-0">
                      <span className="truncate block" title={item.productName}>
                        {item.productName}
                      </span>
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
