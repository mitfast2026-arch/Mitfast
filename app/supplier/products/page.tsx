'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, RefreshCw, Check, X, Eye, Search } from 'lucide-react';
import { useSupplier } from '@/components/portal/SupplierContext';
import ProductFormPanel, { loadProductForPanel } from '@/components/portal/products/ProductFormPanel';
import type { ProductFormMode, ProductFormProduct } from '@/components/portal/products/product-form.types';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { invalidateProductPortalCaches } from '@/lib/client/invalidate-product-portal-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { stripHtmlTags } from '@/lib/html/strip-html';
import { SkeletonTableRows } from '@/components/portal/ds';

export default function SupplierProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-portal-muted">Loading catalog…</div>}>
      <SupplierProductsInner />
    </Suspense>
  );
}

function SupplierProductsInner() {
  const searchParams = useSearchParams();
  const { supplier } = useSupplier();
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ProductFormMode>('create-supplier');
  const [panelProduct, setPanelProduct] = useState<ProductFormProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const deepLinkHandled = useRef<string | null>(null);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) setSearchInput(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadData = useCallback(
    async (showLoading = true, opts?: { force?: boolean }) => {
      if (!supplier) return;
      const searchQuery = debouncedSearch
        ? `&search=${encodeURIComponent(debouncedSearch)}`
        : '';
      const productsUrl = `/api/supplier/products?page=${page}&limit=${PORTAL_PAGE_LIMIT}${searchQuery}`;
      const force = Boolean(opts?.force);
      const existing = force ? null : peekPortalCache<{ products: any[]; total: number }>(productsUrl);
      if (existing) {
        setProducts(existing.data.products || []);
        setTotal(existing.data.total || 0);
        setLoading(false);
      } else if (showLoading) {
        setLoading(true);
      }
      try {
        const [prodsRes, catsRes] = await Promise.all([
          cachedApiGet<{ products: any[]; total: number }>(productsUrl, {
            force: force || (showLoading && !existing),
          }),
          cachedApiGet<{ categories: any[] }>('/api/categories?status=active'),
        ]);

        if (prodsRes.ok) {
          setProducts(prodsRes.data.products || []);
          setTotal(prodsRes.data.total || 0);
          markPortalContentReady('/supplier/products');
        }
        if (catsRes.ok) setCategories(catsRes.data.categories || []);
      } catch (err) {
        console.error('Supplier products load error:', err);
      } finally {
        setLoading(false);
      }
    },
    [supplier, page, debouncedSearch]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreatePanel() {
    setErrorMsg('');
    setPanelProduct(null);
    setPanelMode('create-supplier');
    setDetailLoading(false);
    setPanelOpen(true);
  }

  const openEditPanel = useCallback(async (prod: any) => {
    setErrorMsg('');
    setPanelMode('edit-supplier');
    setPanelProduct(prod);
    setPanelOpen(true);
    setDetailLoading(true);
    try {
      const detail = await loadProductForPanel(prod.id, 'supplier');
      if (detail) {
        setPanelProduct(detail);
      } else {
        setErrorMsg('Failed to load product details. You can still propose an update with listed data.');
      }
    } catch {
      setErrorMsg('Failed to load product');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const action = searchParams.get('action');
    const productId = searchParams.get('product');
    const key = action === 'create' ? 'create' : productId ? `product:${productId}` : '';
    if (!key || deepLinkHandled.current === key) return;
    deepLinkHandled.current = key;

    if (action === 'create') {
      openCreatePanel();
      return;
    }
    if (productId) {
      const listed = products.find((p) => p.id === productId);
      if (listed) {
        void openEditPanel(listed);
      } else {
        void openEditPanel({ id: productId });
      }
    }
  }, [searchParams, products, openEditPanel]);

  function closePanel() {
    setPanelOpen(false);
    setPanelProduct(null);
  }

  const emptyMessage = debouncedSearch
    ? `No products match "${debouncedSearch}". Try a different search term.`
    : 'No products listed yet. Click "Add Product" to submit a new product for review.';

  return (
    <div className="space-y-7 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="saas-badge-gold">Factory Catalog</span>
            <span className="type-meta text-portal-muted">Product Listings</span>
          </div>
          <h1 className="type-page">My Products</h1>
          <p className="text-xs sm:text-sm text-portal-muted mt-0.5">
            Manage listings, base pricing, and submit updates for admin approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreatePanel}
            className="saas-btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => loadData(true, { force: true })}
            className="saas-neu-button text-xs py-2.5 px-3 flex items-center gap-1.5"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-portal-muted" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search your catalog…"
          className="saas-input text-xs pl-9 w-full"
          aria-label="Search catalog"
        />
      </div>

      {successMsg && (
        <div className="p-4 rounded-lg bg-portal-success-soft border border-portal-success/30 text-xs sm:text-sm text-portal-success flex items-center gap-3">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-lg bg-portal-danger-soft border border-portal-danger/30 text-xs sm:text-sm text-portal-danger flex items-center gap-3">
          <X className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="saas-table-container">
        {/* Mobile cards — View/Update always visible */}
        <div className="md:hidden divide-y divide-portal-border">
          {loading && products.length === 0 ? (
            <div className="p-4">
              <SkeletonTableRows rows={4} />
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-portal-muted text-sm px-4">{emptyMessage}</div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="px-4 py-3 space-y-2.5">
                <div className="min-w-0 space-y-1.5">
                  <div className="font-medium text-portal-text text-sm">{p.name}</div>
                  {p.description ? (
                    <div className="text-xs text-portal-muted line-clamp-2">
                      {stripHtmlTags(p.description)}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-portal-muted">
                    <span>{p.category?.name || 'Unassigned'}</span>
                    <span className="type-metric text-portal-text">
                      ₹{p.supplier_price?.toLocaleString('en-IN')}
                    </span>
                    <span>{(p.suggested_moq ?? p.moq) || '—'} Units MOQ</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        p.approval_status === 'approved' ? 'saas-badge-success' : 'saas-badge-gold'
                      }
                    >
                      {(p.approval_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span
                      className={
                        p.publication_status === 'published' ? 'saas-badge-cyan' : 'saas-badge-neutral'
                      }
                    >
                      {(p.publication_status || 'draft').toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditPanel(p)}
                  className="saas-btn-secondary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View / Update</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <table className="saas-table hidden md:table">
          <thead>
            <tr>
              <th>Product name</th>
              <th>Category</th>
              <th>Factory base price</th>
              <th>Suggested MOQ</th>
              <th>Approval status</th>
              <th>Catalog listing</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6">
                  <SkeletonTableRows rows={5} />
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-portal-muted text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-portal-hover"
                  onClick={() => openEditPanel(p)}
                >
                  <td>
                    <div className="font-medium text-portal-text text-sm">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-portal-muted truncate max-w-xs mt-0.5">
                        {stripHtmlTags(p.description)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="text-xs sm:text-sm text-portal-muted">
                      {p.category?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span className="type-metric text-xs sm:text-sm text-portal-text">
                      ₹{p.supplier_price?.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td>
                    <span className="type-metric text-xs sm:text-sm text-portal-muted">
                      {(p.suggested_moq ?? p.moq) || '—'} Units
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        p.approval_status === 'approved' ? 'saas-badge-success' : 'saas-badge-gold'
                      }
                    >
                      {(p.approval_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        p.publication_status === 'published' ? 'saas-badge-cyan' : 'saas-badge-neutral'
                      }
                    >
                      {(p.publication_status || 'draft').toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditPanel(p);
                      }}
                      className="saas-btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5 ml-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View / Update</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProductFormPanel
        open={panelOpen}
        mode={panelMode}
        product={panelProduct}
        categories={categories}
        detailLoading={detailLoading}
        onClose={closePanel}
        onSuccess={() => {
          setSuccessMsg(
            panelMode === 'create-supplier'
              ? 'Product submitted for admin review.'
              : 'Product update request submitted for review.'
          );
          setErrorMsg('');
          invalidateProductPortalCaches();
          loadData(false, { force: true });
        }}
      />

      {total > PORTAL_PAGE_LIMIT && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            className="saas-btn-secondary text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="saas-btn-secondary text-xs"
            disabled={page * PORTAL_PAGE_LIMIT >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
