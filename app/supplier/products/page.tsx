'use client';

import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Check, X, Eye } from 'lucide-react';
import { useSupplier } from '@/components/portal/SupplierContext';
import ProductFormPanel, { loadProductForPanel } from '@/components/portal/products/ProductFormPanel';
import type { ProductFormMode, ProductFormProduct } from '@/components/portal/products/product-form.types';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { SkeletonTableRows } from '@/components/portal/ds';

export default function SupplierProductsPage() {
  const { supplier } = useSupplier();
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ProductFormMode>('create-supplier');
  const [panelProduct, setPanelProduct] = useState<ProductFormProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadData(showLoading = true) {
    if (!supplier) return;
    const productsUrl = `/api/supplier/products?page=${page}&limit=${PORTAL_PAGE_LIMIT}`;
    const existing = peekPortalCache<{ products: any[]; total: number }>(productsUrl);
    if (existing) {
      setProducts(existing.data.products || []);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const [prodsRes, catsRes, settingsRes] = await Promise.all([
        cachedApiGet<{ products: any[]; total: number }>(productsUrl, {
          force: showLoading && !existing,
        }),
        cachedApiGet<{ categories: any[] }>('/api/categories?status=active'),
        cachedApiGet<{ defaultGstRate?: number }>('/api/settings'),
      ]);

      if (prodsRes.ok) {
        setProducts(prodsRes.data.products || []);
        markPortalContentReady('/supplier/products');
      }
      if (catsRes.ok) setCategories(catsRes.data.categories || []);
      if (settingsRes.ok && settingsRes.data?.defaultGstRate != null) {
        setDefaultGstRate(Number(settingsRes.data.defaultGstRate) || 18);
      }
    } catch (err) {
      console.error('Supplier products load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [supplier, page]);

  function openCreatePanel() {
    setErrorMsg('');
    setPanelProduct(null);
    setPanelMode('create-supplier');
    setDetailLoading(false);
    setPanelOpen(true);
  }

  async function openEditPanel(prod: any) {
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
  }

  function closePanel() {
    setPanelOpen(false);
    setPanelProduct(null);
  }

  return (
    <div className="space-y-7 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="saas-badge-gold">Factory Catalog</span>
            <span className="type-meta text-portal-muted">Component Listings</span>
          </div>
          <h1 className="type-page">Component Catalog & Proposals</h1>
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
            <span>Add Component</span>
          </button>
          <button
            onClick={() => loadData()}
            className="saas-neu-button text-xs py-2.5 px-3 flex items-center gap-1.5"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 text-portal-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
        <table className="saas-table">
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
                  No components listed yet. Click &quot;Add Component&quot; to submit a new product for review.
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
                      <div className="text-xs text-portal-muted truncate max-w-xs mt-0.5">{p.description}</div>
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
        defaultGstRate={defaultGstRate}
        detailLoading={detailLoading}
        onClose={closePanel}
        onSuccess={() => {
          setSuccessMsg(
            panelMode === 'create-supplier'
              ? 'Product submitted for QMS review.'
              : 'Product update request submitted for review.'
          );
          setErrorMsg('');
          loadData(false);
        }}
      />
    </div>
  );
}
