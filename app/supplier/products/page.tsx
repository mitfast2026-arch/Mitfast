'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Check, X, Edit3, Loader2 } from 'lucide-react';
import { useSupplier } from '@/components/portal/SupplierContext';
import { apiGet, apiPost } from '@/lib/client/api-client';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';

export default function SupplierProductsPage() {
  const { supplier } = useSupplier();
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isPending, run } = useMutation();

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form State for new product
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [moq, setMoq] = useState<number>(100);
  const [supplierPrice, setSupplierPrice] = useState<number>(100);
  const [gstRate, setGstRate] = useState<number>(18);
  const [discount, setDiscount] = useState<number>(0);
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [sku, setSku] = useState('');
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Update proposal form state
  const [updatePrice, setUpdatePrice] = useState<number>(0);
  const [updateMoq, setUpdateMoq] = useState<number>(100);
  const [updateGst, setUpdateGst] = useState<number>(18);
  const [updateDiscount, setUpdateDiscount] = useState<number>(0);
  const [updateMinValue, setUpdateMinValue] = useState<number>(0);
  const [updateSku, setUpdateSku] = useState('');
  const [updateStock, setUpdateStock] = useState<number>(0);

  async function loadData(showLoading = true) {
    if (!supplier) return;
    if (showLoading) setLoading(true);
    try {
      const [prodsRes, catsRes, settingsRes] = await Promise.all([
        apiGet<{ products: any[]; total: number }>(`/api/supplier/products?page=${page}&limit=50`),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()).catch(() => null),
      ]);

      if (prodsRes.ok) {
        setProducts(prodsRes.data.products || []);
        setTotal(prodsRes.data.total ?? 0);
      }
      if (catsRes.success) setCategories(catsRes.data.categories || []);
      if (settingsRes?.success && settingsRes.data?.defaultGstRate != null) {
        setGstRate(Number(settingsRes.data.defaultGstRate) || 18);
      }
    } catch (err) {
      console.error('Supplier products load error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [supplier, page]);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          name: name.trim(),
          categoryId,
          description: description.trim() || undefined,
          sku: sku.trim() || null,
          stockQuantity,
          moq,
          supplierPrice,
          gstRate,
          gstIncluded: false,
          discount,
          minOrderValue: minOrderValue > 0 ? minOrderValue : null,
          imageUrls: [],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to create product');
      } else {
        const createdId = json.data?.productId;
        if (imageFile && createdId) {
          const fd = new FormData();
          fd.append('file', imageFile);
          fd.append('isPrimary', 'true');
          const imgRes = await fetch(`/api/products/${createdId}/images`, { method: 'POST', body: fd });
          const imgJson = await imgRes.json();
          if (!imgRes.ok || !imgJson.success) {
            setErrorMsg(imgJson.error?.message || 'Product created but image upload failed');
            setCreateModalOpen(false);
            setName('');
            setDescription('');
            setSku('');
            setStockQuantity(0);
            setImageFile(null);
            loadData();
            return;
          }
        }
        setSuccessMsg('Product submitted for QMS review.');
        setCreateModalOpen(false);
        setName('');
        setDescription('');
        setSku('');
        setStockQuantity(0);
        setImageFile(null);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating product');
    }
  }

  function openUpdateModal(prod: any) {
    setSelectedProduct(prod);
    setUpdatePrice(prod.supplier_price || 0);
    setUpdateMoq(prod.moq || 100);
    setUpdateGst(prod.gst_rate ?? 18);
    setUpdateDiscount(prod.discount || 0);
    setUpdateMinValue(prod.min_order_value || 0);
    setUpdateSku(prod.sku || '');
    setUpdateStock(prod.stock_quantity ?? 0);
    setUpdateModalOpen(true);
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct || !supplier) return;

    try {
      const res = await fetch(`/api/products/${selectedProduct.id}/update-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          name: selectedProduct.name,
          categoryId: selectedProduct.category_id || selectedProduct.category?.id,
          sku: updateSku.trim() || null,
          stockQuantity: updateStock,
          supplierPrice: updatePrice,
          moq: updateMoq,
          gstRate: updateGst,
          discount: updateDiscount,
          minOrderValue: updateMinValue > 0 ? updateMinValue : null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to submit update request');
      } else {
        setSuccessMsg('Product update request submitted for review.');
        setUpdateModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting update request');
    }
  }

  return (
    <div className="space-y-7 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="saas-badge-gold">Factory Catalog</span>
            <span className="type-meta text-[#6B7280]">Component Listings</span>
          </div>
          <h1 className="type-page">
            Component Catalog & Proposals
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            Manage precision engineering listings, base pricing, minimum order quantities, and submit specification updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCreateModalOpen(true)}
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
            <RefreshCw className={`w-4 h-4 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs sm:text-sm text-[#15803D] flex items-center gap-3 font-medium">
          <Check className="w-5 h-5 shrink-0 text-[#15803D]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs sm:text-sm text-[#B91C1C] flex items-center gap-3 font-medium">
          <X className="w-5 h-5 shrink-0 text-[#B91C1C]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Products Data Table */}
      <div className="saas-table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Product name</th>
              <th>Category</th>
              <th>Factory base price</th>
              <th>Minimum order (MOQ)</th>
              <th>Approval status</th>
              <th>Catalog listing</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-[#6B7280] text-sm">
                  No components listed yet. Click "Add Component" to submit a new product for QMS audit.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-[#111315] text-sm">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-[#6B7280] truncate max-w-xs mt-0.5">
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="text-xs sm:text-sm text-[#6B7280]">
                      {p.category?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span className="type-metric text-xs sm:text-sm text-[#111315]">
                      ₹{p.supplier_price?.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td>
                    <span className="type-metric text-xs sm:text-sm text-[#6B7280]">
                      {p.moq} Units
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
                  <td className="text-right">
                    <button 
                      onClick={() => openUpdateModal(p)}
                      className="saas-btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5 ml-auto"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Propose Update</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Product Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateProduct} className="w-full max-w-lg p-7 rounded-2xl bg-white border border-[#E2E4E8] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3.5">
              <h3 className="type-section">
                Submit New Component for QMS Review
              </h3>
              <button 
                type="button" 
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="saas-label">Component Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Inconel 718 Hex Cap Bolt M10x50"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="saas-input text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">Category Group *</label>
                  <select 
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="saas-input text-xs sm:text-sm bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="saas-label">Minimum Order Qty (MOQ) *</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    value={moq}
                    onChange={(e) => setMoq(parseInt(e.target.value) || 1)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">SKU</label>
                  <input
                    type="text"
                    maxLength={64}
                    placeholder="Optional factory SKU"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="saas-input text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="saas-label">Available inventory</label>
                  <input
                    type="number"
                    min={0}
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">Factory Base Price (₹) *</label>
                  <input 
                    type="number"
                    required
                    step={1}
                    value={supplierPrice}
                    onChange={(e) => setSupplierPrice(parseFloat(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric text-[#111315]"
                  />
                </div>
                <div>
                  <label className="saas-label">Min order value (₹)</label>
                  <input 
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">GST Rate (%) *</label>
                  <input 
                    type="number"
                    required
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value) || 18)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Discount (₹ per unit)</label>
                  <input 
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>
              <div className="text-xs text-[#6B7280]">
                Estimated selling price (15% margin until admin sets profit): ₹{Math.round((supplierPrice * 1.15) * 100) / 100}
              </div>

              <div>
                <label className="saas-label">Product image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="saas-input text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="saas-label">Technical Specifications & Standards</label>
                <textarea 
                  rows={3}
                  placeholder="Material specs, tolerances, hardness, standards (e.g. DIN 933, Grade 8.8, AS9100 Verified)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="saas-input text-xs sm:text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setCreateModalOpen(false)}
                className="saas-btn-secondary text-xs sm:text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="saas-btn-primary text-xs sm:text-sm py-2.5 px-5"
              >
                Submit Component
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request Update Modal */}
      {updateModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-[#111315]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleUpdateSubmit} className="w-full max-w-lg p-7 rounded-2xl bg-white border border-[#E2E4E8] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] pb-3.5">
              <h3 className="type-section">
                Propose Price / MOQ Update
              </h3>
              <button 
                type="button" 
                onClick={() => setUpdateModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-[#111315] bg-[#F7F7F8] p-3.5 rounded-xl border border-[#E2E4E8] font-medium">
              {selectedProduct.name}
            </div>

            <div className="space-y-4">
              <div>
                <label className="saas-label">Proposed Factory Base Price (₹)</label>
                <input 
                  type="number"
                  required
                  value={updatePrice}
                  onChange={(e) => setUpdatePrice(parseFloat(e.target.value) || 0)}
                  className="saas-input text-xs sm:text-sm type-metric text-[#111315]"
                />
              </div>
              <div>
                <label className="saas-label">Proposed Minimum Order Qty (MOQ)</label>
                <input 
                  type="number"
                  required
                  value={updateMoq}
                  onChange={(e) => setUpdateMoq(parseInt(e.target.value) || 1)}
                  className="saas-input text-xs sm:text-sm type-metric"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">GST Rate (%)</label>
                  <input 
                    type="number"
                    value={updateGst}
                    onChange={(e) => setUpdateGst(parseFloat(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
                <div>
                  <label className="saas-label">Discount (₹ per unit)</label>
                  <input 
                    type="number"
                    min={0}
                    value={updateDiscount}
                    onChange={(e) => setUpdateDiscount(parseFloat(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>
              <div>
                <label className="saas-label">Min order value (₹)</label>
                <input 
                  type="number"
                  min={0}
                  value={updateMinValue}
                  onChange={(e) => setUpdateMinValue(parseFloat(e.target.value) || 0)}
                  className="saas-input text-xs sm:text-sm type-metric"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="saas-label">SKU</label>
                  <input
                    type="text"
                    maxLength={64}
                    value={updateSku}
                    onChange={(e) => setUpdateSku(e.target.value)}
                    className="saas-input text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="saas-label">Available inventory</label>
                  <input
                    type="number"
                    min={0}
                    value={updateStock}
                    onChange={(e) => setUpdateStock(parseInt(e.target.value) || 0)}
                    className="saas-input text-xs sm:text-sm type-metric"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E4E8]">
              <button 
                type="button" 
                onClick={() => setUpdateModalOpen(false)}
                className="saas-btn-secondary text-xs sm:text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="saas-btn-primary text-xs sm:text-sm py-2.5 px-5"
              >
                Submit Proposal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
