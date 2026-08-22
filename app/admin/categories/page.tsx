'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, RefreshCw, Check, AlertCircle } from 'lucide-react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to create category.');
      } else {
        setSuccessMsg(`Category "${newCatName}" created successfully.`);
        setNewCatName('');
        loadCategories();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating category.');
    }
  }

  async function handleDeleteCategory(catId: string, name: string) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/categories?id=${catId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || `Cannot delete category "${name}" because products are assigned to it.`);
      } else {
        setSuccessMsg(`Category "${name}" deleted.`);
        loadCategories();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting category.');
    }
  }

  async function handleCategoryImageUpload(catId: string, file: File) {
    setErrorMsg('');
    setUploadingCatId(catId);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch(`/api/categories/${catId}/image`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to upload category image');
        return;
      }
      setSuccessMsg('Category image uploaded.');
      loadCategories();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCatId(null);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Categories
          </h1>
          <p className="type-subtitle">
            Manage product catalog categories and public catalog taxonomy.
          </p>
        </div>

        <button 
          onClick={loadCategories} 
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#B91C1C]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#15803D] flex items-center gap-2.5 shadow-sm">
          <Check className="w-4 h-4 shrink-0 text-[#15803D]" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Add Form (4 cols) */}
        <form onSubmit={handleCreateCategory} className="lg:col-span-4 saas-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <Layers className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">
              Add category
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="saas-label">Category Name *</label>
            <input 
              type="text"
              required
              placeholder="e.g. Fasteners"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="saas-input text-xs"
            />
          </div>

          <button type="submit" className="saas-btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>Create Category</span>
          </button>
        </form>

        {/* Categories Table (8 cols) */}
        <div className="lg:col-span-8 saas-table-container">
          <table className="saas-table text-xs">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-16">Image</th>
                <th>Category name</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-[#6B7280]">
                    Loading categories…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-[#6B7280]">
                    No categories yet. Create one using the form.
                  </td>
                </tr>
              ) : (
                categories.map((cat, idx) => {
                  const imageUrl = cat.imageUrl || cat.image_url;
                  return (
                  <tr key={cat.id}>
                    <td className="text-[#6B7280]">{idx + 1}</td>
                    <td>
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-[#E2E4E8]"
                        />
                      ) : (
                        <span className="inline-flex w-10 h-10 rounded-lg bg-[#F7F7F8] border border-[#E2E4E8] items-center justify-center text-[10px] text-[#9CA3AF]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="font-medium text-[#111315]">
                      <div>{cat.name}</div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingCatId === cat.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCategoryImageUpload(cat.id, file);
                        }}
                        className="text-[10px] mt-1 max-w-[180px]"
                      />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2]"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
