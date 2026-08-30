'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, RefreshCw, Package, ArrowUpRight } from 'lucide-react';
import { useSupplier } from '@/components/portal/SupplierContext';

type ProductViewRow = {
  productId: string;
  productName: string;
  views: number;
  enquiries: number;
  rfqs: number;
  orders: number;
};

export default function SupplierProductViewsPage() {
  const { supplier } = useSupplier();
  const [products, setProducts] = useState<ProductViewRow[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    if (!supplier?.id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/stats`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to load product views.');
        setProducts([]);
        setTotalViews(0);
        return;
      }
      const rows = (json.data?.products || []) as ProductViewRow[];
      setProducts(rows);
      setTotalViews(json.data?.summary?.totalViews ?? rows.reduce((sum, p) => sum + (p.views || 0), 0));
    } catch {
      setErrorMsg('Failed to load product views.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [supplier?.id]);

  const ranked = [...products].sort((a, b) => (b.views || 0) - (a.views || 0));

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">Product views</h1>
          <p className="type-subtitle">
            Catalog impressions for each of your listed products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/supplier/products" className="saas-btn-secondary text-xs py-2 px-3.5 gap-1.5">
            <Package className="w-3.5 h-3.5" />
            My Products
          </Link>
          <button
            type="button"
            onClick={loadData}
            className="saas-neu-button text-xs py-2 px-3 flex items-center gap-1.5"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="saas-kpi-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="saas-icon-well">
            <Eye className="w-4 h-4" />
          </span>
          <div>
            <div className="type-kpi-label">Total product views</div>
            <div className="type-kpi mt-1">{loading ? '—' : totalViews.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="type-kpi-meta">
          {loading ? 'Loading…' : `${ranked.length} product${ranked.length === 1 ? '' : 's'} tracked`}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-portal-danger-soft border border-portal-danger/30 text-xs text-portal-danger">
          {errorMsg}
        </div>
      )}

      <div className="saas-panel p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="type-section">Views by product</h3>
          <span className="type-meta bg-portal-inset px-2.5 py-1 rounded-full border border-portal-border">
            Sorted by views
          </span>
        </div>

        <div className="saas-table-container overflow-x-auto">
          <table className="saas-table min-w-[34rem]">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-center">Views</th>
                <th className="text-center">Enquiries</th>
                <th className="text-center">RFQs</th>
                <th className="text-center">Orders</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center type-empty-body">
                    Loading product views…
                  </td>
                </tr>
              ) : !ranked.length ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center type-empty-body">
                    No product views recorded yet. Views appear when buyers open your listings.
                  </td>
                </tr>
              ) : (
                ranked.map((item) => (
                  <tr key={item.productId}>
                    <td className="font-medium text-portal-text">{item.productName}</td>
                    <td className="text-center type-metric">{item.views ?? 0}</td>
                    <td className="text-center type-metric">{item.enquiries ?? 0}</td>
                    <td className="text-center type-metric">{item.rfqs ?? 0}</td>
                    <td className="text-center type-metric">{item.orders ?? 0}</td>
                    <td className="text-right">
                      <Link
                        href={`/supplier/products?product=${item.productId}`}
                        className="inline-flex items-center gap-1 text-xs text-portal-muted hover:text-portal-text"
                      >
                        Open
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
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
