'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus,
  Search, 
  Eye, 
  EyeOff, 
  Archive, 
  RotateCcw, 
  Edit3, 
  X,
  RefreshCw,
  Check,
  Loader2,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import { notifyApprovalsChanged } from '@/components/portal/ApprovalsCountContext';

function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseSpecs(raw: string): { spec_name: string; spec_value: string; sort_order: number }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const sep = line.includes(':') ? ':' : '=';
      const i = line.indexOf(sep);
      if (i === -1) {
        return { spec_name: line, spec_value: '', sort_order: idx };
      }
      return {
        spec_name: line.slice(0, i).trim() || `Spec ${idx + 1}`,
        spec_value: line.slice(i + 1).trim(),
        sort_order: idx,
      };
    })
    .filter((s) => s.spec_name && s.spec_value);
}

function specsToText(specs: any[] | undefined): string {
  if (!specs?.length) return '';
  return [...specs]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => `${s.spec_name}: ${s.spec_value}`)
    .join('\n');
}

function imagesToText(images: any[] | undefined): string {
  if (!images?.length) return '';
  return [...images]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img) => img.image_url)
    .filter(Boolean)
    .join('\n');
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [formError, setFormError] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSupplierPrice, setEditSupplierPrice] = useState<number>(0);
  const [editMoq, setEditMoq] = useState<number>(100);
  const [editRibbon, setEditRibbon] = useState<string>('');
  const [editGst, setEditGst] = useState<number>(18);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editProfit, setEditProfit] = useState<number>(15);
  const [editMinValue, setEditMinValue] = useState<number>(0);
  const [editImageUrls, setEditImageUrls] = useState('');
  const [editSpecs, setEditSpecs] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editStock, setEditStock] = useState<number>(0);

  // Create form state
  const [createSupplierId, setCreateSupplierId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createMoq, setCreateMoq] = useState<number>(100);
  const [createSupplierPrice, setCreateSupplierPrice] = useState<number>(100);
  const [createGst, setCreateGst] = useState<number>(18);
  const [createDiscount, setCreateDiscount] = useState<number>(0);
  const [createMinValue, setCreateMinValue] = useState<number>(0);
  const [createImageUrls, setCreateImageUrls] = useState('');
  const [createSpecs, setCreateSpecs] = useState('');
  const [createSku, setCreateSku] = useState('');
  const [createStock, setCreateStock] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { isPending, run } = useMutation();

  async function loadLookups() {
    try {
      const [catsRes, supsRes] = await Promise.all([
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/suppliers?status=active&limit=100').then((r) => r.json()),
      ]);
      if (catsRes.success) setCategories(catsRes.data.categories || []);
      if (supsRes.success) setSuppliers(supsRes.data.suppliers || []);
    } catch (err) {
      console.error('Failed to load lookups:', err);
    }
  }

  const loadProducts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await apiGet<{ products: any[]; total: number }>(
        `/api/products?mode=admin&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=50`
      );
      if (result.ok) {
        setProducts(result.data.products || []);
        setTotal(result.data.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [searchTerm, page]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function patchProduct(productId: string, patch: Record<string, unknown>) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p))
    );
  }

  async function handleApproveProduct(productId: string) {
    setRowError(null);
    await run(
      () => apiPost(`/api/products/${productId}/approve`),
      {
        key: mutationKey(productId, 'approve'),
        onSuccess: () => {
          patchProduct(productId, { approval_status: 'approved' });
          notifyApprovalsChanged();
        },
        onError: (msg) => setRowError(msg),
      }
    );
  }

  async function handleTogglePublish(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'published' ? 'unpublish' : 'publish';
    const nextStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    setRowError(null);

    await run(
      () => apiPost(`/api/products/${productId}/${endpoint}`),
      {
        key: mutationKey(productId, endpoint),
        optimistic: () => patchProduct(productId, { publication_status: nextStatus }),
        rollback: () => patchProduct(productId, { publication_status: currentStatus }),
        onError: (msg) => setRowError(msg),
      }
    );
  }

  async function handleToggleArchive(productId: string, currentStatus: string) {
    const endpoint = currentStatus === 'archived' ? 'restore' : 'archive';
    const nextStatus = currentStatus === 'archived' ? 'active' : 'archived';
    setRowError(null);

    await run(
      () => apiPost(`/api/products/${productId}/${endpoint}`),
      {
        key: mutationKey(productId, endpoint),
        optimistic: () => patchProduct(productId, { archive_status: nextStatus }),
        rollback: () => patchProduct(productId, { archive_status: currentStatus }),
        onError: (msg) => setRowError(msg),
      }
    );
  }

  function openCreateModal() {
    setFormError('');
    setCreateSupplierId('');
    setCreateName('');
    setCreateCategoryId('');
    setCreateDescription('');
    setCreateMoq(100);
    setCreateSupplierPrice(100);
    setCreateGst(18);
    setCreateDiscount(0);
    setCreateMinValue(0);
    setCreateImageUrls('');
    setCreateSpecs('');
    setCreateSku('');
    setCreateStock(0);
    setCreateModalOpen(true);
  }

  async function openEditModal(prod: any) {
    setFormError('');
    setSelectedProduct(prod);
    setEditModalOpen(true);
    setDetailLoading(true);

    try {
      const result = await apiGet<{ product: any }>(`/api/products/${prod.id}?mode=admin`);
      const detail = result.ok ? result.data.product : prod;
      setSelectedProduct(detail);
      setEditName(detail.name || '');
      setEditDescription(detail.description || '');
      setEditCategoryId(detail.category_id || detail.category?.id || '');
      setEditSupplierPrice(detail.supplier_price || 0);
      setEditMoq(detail.moq || 100);
      setEditRibbon(detail.ribbon_label || '');
      setEditGst(detail.gst_rate ?? 18);
      setEditDiscount(detail.discount || 0);
      setEditProfit(detail.profit_value ?? 15);
      setEditMinValue(detail.min_order_value || 0);
      setEditImageUrls(imagesToText(detail.images));
      setEditSpecs(specsToText(detail.specifications));
      setEditSku(detail.sku || '');
      setEditStock(detail.stock_quantity ?? 0);
    } catch {
      setFormError('Failed to load product details');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setCreating(true);

    try {
      const imageUrls = parseImageUrls(createImageUrls);
      const specifications = parseSpecs(createSpecs);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: createSupplierId,
          name: createName.trim(),
          categoryId: createCategoryId,
          description: createDescription.trim() || undefined,
          moq: createMoq,
          supplierPrice: createSupplierPrice,
          gstRate: createGst,
          gstIncluded: false,
          discount: createDiscount,
          minOrderValue: createMinValue > 0 ? createMinValue : null,
          sku: createSku.trim() || null,
          stockQuantity: createStock,
          imageUrls,
          specifications,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to create product');
        return;
      }

      const newId = json.data?.productId;
      if (newId && createImageUrls.trim()) {
        // URL rows already inserted via imageUrls; file uploads use /images API after create
      }

      setCreateModalOpen(false);
      await loadProducts(false);
    } catch (err) {
      console.error('Create product error:', err);
      setFormError('Failed to create product');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setFormError('');
    setSaving(true);

    try {
      const imageUrls = parseImageUrls(editImageUrls);
      const specifications = parseSpecs(editSpecs);

      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          categoryId: editCategoryId || undefined,
          supplierPrice: editSupplierPrice,
          moq: editMoq,
          ribbonLabel: editRibbon || null,
          gstRate: editGst,
          discount: editDiscount,
          profitType: 'percentage',
          profitValue: editProfit,
          minOrderValue: editMinValue > 0 ? editMinValue : null,
          sku: editSku.trim() || null,
          stockQuantity: editStock,
          imageUrls,
          specifications,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to save product');
        return;
      }

      setEditModalOpen(false);
      await loadProducts(false);
    } catch (err) {
      console.error('Save product edit error:', err);
      setFormError('Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Component Catalog
          </h1>
          <p className="type-subtitle">
            Manage precision engineering components, factory base pricing, and public catalog publication states.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={openCreateModal}
            className="saas-btn-primary text-xs py-2 px-3.5 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Product</span>
          </button>
          <button 
            onClick={() => loadProducts()}
            className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Catalog</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="saas-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input 
            type="text"
            placeholder="Search components by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="saas-input pl-9 text-xs"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        </div>

        <div className="text-xs text-[#6B7280]">
          Total Products: <b className="text-[#111315]">{total}</b>
          {loading && products.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[#6B7280]">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating…
            </span>
          )}
        </div>
      </div>

      {rowError && (
        <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] rounded-lg p-2.5 flex items-center justify-between">
          <span>{rowError}</span>
          <button type="button" onClick={() => setRowError(null)} className="text-[#B91C1C] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Component name</th>
              <th>Supplier</th>
              <th>Factory base</th>
              <th>List price</th>
              <th>Approval</th>
              <th>Catalog visibility</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#6B7280] text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading catalog…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#6B7280] text-xs">
                  No components found matching your search query.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-[#111315]">{p.name}</div>
                    <div className="text-xs text-[#6B7280] flex items-center gap-2 mt-0.5">
                      <span>{p.category?.name || '—'}</span>
                      <span>•</span>
                      <span>MOQ: {p.moq}</span>
                      {p.ribbon_label && (
                        <span className="saas-badge-gold text-[10px] py-0 px-1.5">
                          {p.ribbon_label}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className="text-xs text-[#111315] font-medium">
                      {p.supplier?.company_name || 'Unknown'}
                    </span>
                  </td>

                  <td>
                    <span className="type-metric text-xs text-[#6B7280]">
                      ₹{p.supplier_price?.toLocaleString('en-IN')}
                    </span>
                  </td>

                  <td>
                    <span className="type-metric text-xs text-[#111315]">
                      ₹{p.selling_price?.toLocaleString('en-IN')}
                    </span>
                  </td>

                  <td>
                    <span className={p.approval_status === 'approved' ? 'saas-badge-success' : 'saas-badge-gold'}>
                      {p.approval_status.toUpperCase()}
                    </span>
                  </td>

                  <td>
                    <span className={p.publication_status === 'published' ? 'saas-badge-cyan' : 'saas-badge-neutral'}>
                      {p.publication_status.toUpperCase()}
                    </span>
                  </td>

                  <td className="text-right space-x-1.5">
                    {(p.approval_status === 'pending' || p.approval_status === 'update_pending') && (
                      <button
                        onClick={() => handleApproveProduct(p.id)}
                        disabled={isPending(mutationKey(p.id, 'approve'))}
                        className="p-1.5 rounded-full text-[#15803D] bg-[#F0FDF4] hover:bg-[#BBF7D0] disabled:opacity-50"
                        title="Approve product"
                      >
                        {isPending(mutationKey(p.id, 'approve')) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button 
                      onClick={() => openEditModal(p)}
                      disabled={detailLoading && selectedProduct?.id === p.id}
                      className="p-1.5 rounded-full text-[#6B7280] hover:text-[#111315] hover:bg-[#ECEEF0] disabled:opacity-50"
                      title="Edit product"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleTogglePublish(p.id, p.publication_status)}
                      disabled={isPending(mutationKey(p.id, p.publication_status === 'published' ? 'unpublish' : 'publish'))}
                      className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
                        p.publication_status === 'published'
                          ? 'text-[#111315] bg-[#ECEEF0] hover:bg-[#D7D9DC]'
                          : 'text-[#6B7280] bg-[#F7F7F8] hover:bg-[#ECEEF0]'
                      }`}
                      title={p.publication_status === 'published' ? 'Unpublish' : 'Publish'}
                    >
                      {isPending(mutationKey(p.id, p.publication_status === 'published' ? 'unpublish' : 'publish')) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : p.publication_status === 'published' ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button 
                      onClick={() => handleToggleArchive(p.id, p.archive_status)}
                      disabled={isPending(mutationKey(p.id, p.archive_status === 'archived' ? 'restore' : 'archive'))}
                      className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${
                        p.archive_status === 'archived'
                          ? 'text-[#15803D] bg-[#F0FDF4] hover:bg-[#BBF7D0]'
                          : 'text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FECACA]'
                      }`}
                      title={p.archive_status === 'archived' ? 'Restore' : 'Archive'}
                    >
                      {isPending(mutationKey(p.id, p.archive_status === 'archived' ? 'restore' : 'archive')) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : p.archive_status === 'archived' ? (
                        <RotateCcw className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="flex justify-end gap-2">
          <button type="button" className="saas-btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <button type="button" className="saas-btn-secondary text-xs" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Create Product Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateProduct} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <h3 className="text-base text-[#111315]">Create Product</h3>
              <button 
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-full text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] rounded-lg p-2.5">{formError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="saas-label">Supplier</label>
                <select
                  required
                  value={createSupplierId}
                  onChange={(e) => setCreateSupplierId(e.target.value)}
                  className="saas-input text-xs"
                >
                  <option value="">Select active supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="saas-label">Product name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label className="saas-label">Category</label>
                <select
                  required
                  value={createCategoryId}
                  onChange={(e) => setCreateCategoryId(e.target.value)}
                  className="saas-input text-xs"
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="saas-label">Description</label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="saas-input text-xs resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="saas-label">Factory Base Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={createSupplierPrice}
                    onChange={(e) => setCreateSupplierPrice(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">MOQ</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={createMoq}
                    onChange={(e) => setCreateMoq(parseInt(e.target.value) || 1)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">SKU</label>
                  <input
                    type="text"
                    value={createSku}
                    onChange={(e) => setCreateSku(e.target.value)}
                    className="saas-input text-xs sm:text-sm"
                    placeholder="Optional SKU"
                  />
                </div>
                <div>
                  <label className="saas-label">Stock qty</label>
                  <input
                    type="number"
                    min={0}
                    value={createStock}
                    onChange={(e) => setCreateStock(parseInt(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">GST Rate (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={createGst}
                    onChange={(e) => setCreateGst(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Discount (₹ / unit)</label>
                  <input
                    type="number"
                    min={0}
                    value={createDiscount}
                    onChange={(e) => setCreateDiscount(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div className="col-span-2">
                  <label className="saas-label">Min order value (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={createMinValue}
                    onChange={(e) => setCreateMinValue(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
              </div>

              <div>
                <label className="saas-label">Image URLs (one per line, max 8)</label>
                <textarea
                  rows={2}
                  placeholder="https://…"
                  value={createImageUrls}
                  onChange={(e) => setCreateImageUrls(e.target.value)}
                  className="saas-input text-xs resize-y font-mono"
                />
              </div>

              <div>
                <label className="saas-label">Specifications (Name: Value per line)</label>
                <textarea
                  rows={2}
                  placeholder="Material: Titanium&#10;Grade: 5"
                  value={createSpecs}
                  onChange={(e) => setCreateSpecs(e.target.value)}
                  className="saas-input text-xs resize-y font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setCreateModalOpen(false)}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={creating}
                className="saas-btn-primary text-xs py-2 px-4"
              >
                {creating ? 'Creating…' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expanded product editor */}
      {editModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3">
              <h3 className="text-base text-[#111315]">
                Edit Component
              </h3>
              <button 
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-full text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] rounded-lg p-2.5">{formError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="saas-label">Product name</label>
                <input 
                  type="text"
                  required
                  minLength={2}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label className="saas-label">Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="saas-input text-xs"
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="saas-label">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="saas-input text-xs resize-y"
                />
              </div>

              <div>
                <label className="saas-label">Factory Base Price (₹)</label>
                <input 
                  type="number"
                  required
                  value={editSupplierPrice}
                  onChange={(e) => setEditSupplierPrice(parseFloat(e.target.value) || 0)}
                  className="saas-input type-metric text-[#111315]"
                />
              </div>

              <div>
                <label className="saas-label">Minimum Order Qty (MOQ)</label>
                <input 
                  type="number"
                  required
                  value={editMoq}
                  onChange={(e) => setEditMoq(parseInt(e.target.value) || 1)}
                  className="saas-input type-metric"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="saas-label">SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="saas-input text-xs sm:text-sm"
                    placeholder="Optional SKU"
                  />
                </div>
                <div>
                  <label className="saas-label">Stock qty</label>
                  <input
                    type="number"
                    min={0}
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="saas-label">GST Rate (%)</label>
                  <input 
                    type="number"
                    value={editGst}
                    onChange={(e) => setEditGst(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Discount (₹ / unit)</label>
                  <input 
                    type="number"
                    min={0}
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Profit (%)</label>
                  <input 
                    type="number"
                    min={0}
                    value={editProfit}
                    onChange={(e) => setEditProfit(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Min order value (₹)</label>
                  <input 
                    type="number"
                    min={0}
                    value={editMinValue}
                    onChange={(e) => setEditMinValue(parseFloat(e.target.value) || 0)}
                    className="saas-input type-metric"
                  />
                </div>
              </div>

              <div className="text-xs text-[#6B7280] bg-[#F7F7F8] rounded-lg p-2.5">
                Selling (list): ₹{Math.round((editSupplierPrice + editSupplierPrice * (editProfit / 100)) * 100) / 100}
                {' · '}
                Actual (after discount): ₹{Math.max(0, Math.round((editSupplierPrice + editSupplierPrice * (editProfit / 100) - editDiscount) * 100) / 100)}
              </div>

              <div>
                <label className="saas-label">Ribbon Badge Tag</label>
                <input 
                  type="text"
                  placeholder="e.g. Available inventory, Aerospace grade"
                  value={editRibbon}
                  onChange={(e) => setEditRibbon(e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label className="saas-label">Image URLs (one per line, max 8)</label>
                <textarea
                  rows={2}
                  placeholder="https://…"
                  value={editImageUrls}
                  onChange={(e) => setEditImageUrls(e.target.value)}
                  className="saas-input text-xs resize-y font-mono"
                />
              </div>

              <div>
                <label className="saas-label">Specifications (Name: Value per line)</label>
                <textarea
                  rows={2}
                  placeholder="Material: Titanium"
                  value={editSpecs}
                  onChange={(e) => setEditSpecs(e.target.value)}
                  className="saas-input text-xs resize-y font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setEditModalOpen(false)}
                className="saas-btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="saas-btn-primary text-xs py-2 px-4"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
