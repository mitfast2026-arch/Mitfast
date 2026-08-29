'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { PORTAL_PAGE_LIMIT } from '@/lib/client/portal-nav-prefetch';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';
import { invalidateProductPortalCaches } from '@/lib/client/invalidate-product-portal-cache';
import ProductFormPanel, { loadProductForPanel } from '@/components/portal/products/ProductFormPanel';
import type { ProductFormMode, ProductFormProduct } from '@/components/portal/products/product-form.types';
import ProductCard from './ProductCard';
import ProductDeleteDialog from './ProductDeleteDialog';
import type { AdminProduct } from './types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminToolbar from '@/components/admin/AdminToolbar';

function AdminProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [rowError, setRowError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ProductFormMode>('create-admin');
  const [panelProduct, setPanelProduct] = useState<ProductFormProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { isPending, run } = useMutation();

  async function loadLookups() {
    try {
      const [catsRes, supsRes, settingsRes] = await Promise.all([
        cachedApiGet<{ categories: any[] }>('/api/categories?mode=admin&status=active'),
        cachedApiGet<{ suppliers: any[] }>('/api/suppliers?status=active&limit=100'),
        cachedApiGet<{ defaultGstRate?: number }>('/api/settings'),
      ]);
      if (catsRes.ok) setCategories(catsRes.data.categories || []);
      if (supsRes.ok) setSuppliers(supsRes.data.suppliers || []);
      if (settingsRes.ok && settingsRes.data?.defaultGstRate != null) {
        setDefaultGstRate(Number(settingsRes.data.defaultGstRate) || 18);
      }
    } catch (err) {
      console.error('Failed to load lookups:', err);
    }
  }

  const loadProducts = useCallback(async (showLoading = true, opts?: { force?: boolean }) => {
    const url = `/api/products?mode=admin&search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${PORTAL_PAGE_LIMIT}&sort=newest`;
    const force = Boolean(opts?.force);
    const existing = force ? null : peekPortalCache<{ products: AdminProduct[]; total: number }>(url);
    if (existing) {
      setProducts(existing.data.products || []);
      setTotal(existing.data.total ?? 0);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const result = await cachedApiGet<{ products: AdminProduct[]; total: number }>(url, {
        force: force || (showLoading && !existing),
      });
      if (result.ok) {
        setProducts(result.data.products || []);
        setTotal(result.data.total ?? 0);
        markPortalContentReady('/admin/products');
      } else {
        setLoadError(result.message);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setLoadError('Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const reviewId = searchParams.get('review');
  const reviewOpenedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!reviewId || reviewOpenedRef.current === reviewId) return;
    reviewOpenedRef.current = reviewId;
    const prod = products.find((p) => p.id === reviewId);
    if (prod) {
      void openEditPanel(prod, true);
      return;
    }
    void (async () => {
      setPanelOpen(true);
      setPanelMode('review-admin');
      setDetailLoading(true);
      try {
        const detail = await loadProductForPanel(reviewId);
        if (detail) {
          setPanelProduct(detail);
        } else {
          toast.error('Product not found');
          setPanelOpen(false);
          reviewOpenedRef.current = null;
        }
      } catch {
        toast.error('Failed to load product for review');
        setPanelOpen(false);
        reviewOpenedRef.current = null;
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [reviewId, products]);

  function patchProduct(productId: string, patch: Record<string, unknown>) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p))
    );
    if (panelProduct?.id === productId) {
      setPanelProduct((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }

  function openCreatePanel() {
    setPanelProduct(null);
    setPanelMode('create-admin');
    setPanelOpen(true);
  }

  async function openEditPanel(prod: AdminProduct, review = false) {
    setPanelOpen(true);
    setPanelMode(review ? 'review-admin' : 'edit-admin');
    setPanelProduct(prod as ProductFormProduct);
    setDetailLoading(true);
    try {
      const detail = await loadProductForPanel(prod.id);
      if (detail) setPanelProduct(detail);
    } catch {
      setRowError('Failed to load product details');
    } finally {
      setDetailLoading(false);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setPanelProduct(null);
    setDetailLoading(false);
  }

  async function handleApproveProduct(productId: string) {
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/approve`), {
      key: mutationKey(productId, 'approve'),
      onSuccess: () => {
        patchProduct(productId, { approval_status: 'approved' });
        notifyApprovalsChanged();
        toast.success('Product approved');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleTogglePublish(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'published' ? 'unpublish' : 'publish';
    const nextStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/${endpoint}`), {
      key: mutationKey(productId, endpoint),
      optimistic: () => patchProduct(productId, { publication_status: nextStatus }),
      rollback: () => patchProduct(productId, { publication_status: currentStatus }),
      onSuccess: () => {
        toast.success(nextStatus === 'published' ? 'Product published' : 'Product unpublished');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  async function handleToggleArchive(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'archived' ? 'restore' : 'archive';
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    setRowError(null);
    await run(() => apiPost(`/api/products/${productId}/${endpoint}`), {
      key: mutationKey(productId, endpoint),
      optimistic: () => patchProduct(productId, { archive_status: nextStatus }),
      rollback: () => patchProduct(productId, { archive_status: currentStatus }),
      onSuccess: () => {
        toast.success(nextStatus === 'active' ? 'Product restored' : 'Product archived');
      },
      onError: (msg) => {
        setRowError(msg);
        toast.error(msg);
      },
    });
  }

  function openDeleteDialog(prod: AdminProduct) {
    setDeleteTarget(prod);
    setDeleteConfirmName('');
    setDeleteError('');
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Failed to delete product';
        setDeleteError(msg);
        toast.error(msg);
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success('Product deleted successfully');
      setDeleteTarget(null);
      if (panelProduct?.id === deleteTarget.id) closePanel();
    } catch {
      setDeleteError('Failed to delete product');
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  }

  const supplierName =
    suppliers.find((s) => s.id === panelProduct?.supplier_id)?.company_name ||
    panelProduct?.supplier?.company_name ||
    '';

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="Product Catalog"
        description="Manage products, pricing, and catalog publication status."
        actions={
          <>
            <button type="button" onClick={openCreatePanel} className="saas-btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Create Product
            </button>
            <button onClick={() => loadProducts(true, { force: true })} className="saas-btn-secondary gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <AdminToolbar
        trailing={
          <div className="text-sm text-portal-muted">
            Total: <b className="text-portal-text">{total}</b>
            {loading && products.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
              </span>
            )}
          </div>
        }
      >
        <div className="saas-search-field w-full sm:max-w-md">
          <Search className="saas-search-icon" />
          <input
            type="text"
            placeholder="Search products by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input w-full"
          />
        </div>
      </AdminToolbar>

      {(rowError || loadError) && (
        <div className="text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5 flex items-center justify-between">
          <span>{rowError || loadError}</span>
          <button
            type="button"
            onClick={() => {
              setRowError(null);
              setLoadError(null);
            }}
            className="hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading catalog…
        </div>
      ) : products.length === 0 ? (
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">
          No products found matching your search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isPending={isPending}
              mutationKey={mutationKey}
              detailLoading={detailLoading}
              selectedProductId={panelProduct?.id}
              onEdit={(prod) =>
                openEditPanel(
                  prod,
                  prod.approval_status === 'pending' ||
                    prod.has_open_update_request ||
                    prod.approval_status === 'update_pending'
                )
              }
              onApprove={handleApproveProduct}
              onTogglePublish={handleTogglePublish}
              onToggleArchive={handleToggleArchive}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}

      {total > PORTAL_PAGE_LIMIT && (
        <div className="flex justify-end gap-2">
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

      <ProductFormPanel
        open={panelOpen}
        mode={panelMode}
        product={panelProduct}
        categories={categories}
        suppliers={suppliers}
        supplierName={supplierName}
        defaultGstRate={defaultGstRate}
        detailLoading={detailLoading}
        onClose={closePanel}
        onSuccess={() => {
          invalidateProductPortalCaches();
          loadProducts(false, { force: true });
          notifyApprovalsChanged();
        }}
        onApprove={
          panelProduct
            ? () => handleApproveProduct(panelProduct.id)
            : undefined
        }
        onTogglePublish={
          panelProduct
            ? () =>
                handleTogglePublish(
                  panelProduct.id,
                  panelProduct.publication_status || 'unpublished'
                )
            : undefined
        }
        onToggleArchive={
          panelProduct
            ? () =>
                handleToggleArchive(
                  panelProduct.id,
                  panelProduct.archive_status || 'active'
                )
            : undefined
        }
        isPending={isPending}
        mutationKey={mutationKey}
      />

      {deleteTarget && (
        <ProductDeleteDialog
          product={deleteTarget}
          confirmName={deleteConfirmName}
          onConfirmNameChange={setDeleteConfirmName}
          deleting={deleting}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="saas-panel py-16 text-center text-portal-muted text-xs">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading catalog…
        </div>
      }
    >
      <AdminProductsPageContent />
    </Suspense>
  );
}
