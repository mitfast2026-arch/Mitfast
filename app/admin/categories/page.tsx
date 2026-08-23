'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Archive,
  RotateCcw,
  Pencil,
  Loader2,
  X,
} from 'lucide-react';
import { apiPost, apiPut, apiDelete } from '@/lib/client/api-client';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
} from '@/lib/client/portal-data-cache';
import { useMutation, mutationKey } from '@/lib/client/use-mutation';
import type { CategoryListItem } from '@/types/category';
import CategoryArchiveDialog from './CategoryArchiveDialog';
import CategoryDeleteDialog from './CategoryDeleteDialog';
import CategoryEditDialog from './CategoryEditDialog';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

type StatusFilter = 'active' | 'archived';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [tabCounts, setTabCounts] = useState<{ active: number; archived: number }>({
    active: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<CategoryListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');

  const [archiveTarget, setArchiveTarget] = useState<CategoryListItem | null>(null);
  const [archiveError, setArchiveError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const { isPending, run } = useMutation();

  const refreshTabCounts = useCallback(async () => {
    const [activeRes, archivedRes] = await Promise.all([
      cachedApiGet<{ categories: CategoryListItem[] }>('/api/categories?mode=admin&status=active'),
      cachedApiGet<{ categories: CategoryListItem[] }>('/api/categories?mode=admin&status=archived'),
    ]);
    setTabCounts({
      active: activeRes.ok ? activeRes.data.categories?.length ?? 0 : 0,
      archived: archivedRes.ok ? archivedRes.data.categories?.length ?? 0 : 0,
    });
  }, []);

  const loadCategories = useCallback(async (showLoading = true) => {
    const url = `/api/categories?mode=admin&status=${statusFilter}`;
    const existing = peekPortalCache<{ categories: CategoryListItem[] }>(url);
    if (existing) {
      setCategories(existing.data.categories || []);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await cachedApiGet<{ categories: CategoryListItem[] }>(url, {
        force: showLoading && !existing,
      });
      if (result.ok) {
        setCategories(result.data.categories || []);
        markPortalContentReady('/admin/categories');
      } else {
        setErrorMsg(result.message);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    refreshTabCounts();
  }, [refreshTabCounts]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const name = newCatName.trim();
    if (!name) return;

    await run(() => apiPost<{ categoryId: string }>('/api/categories', { name }), {
      key: 'create-category',
      onSuccess: () => {
        setSuccessMsg(`Category "${name}" created successfully.`);
        setNewCatName('');
        loadCategories(false);
        refreshTabCounts();
      },
      onError: (msg) => setErrorMsg(msg),
    });
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setEditError('');

    const name = editName.trim();
    await run(() => apiPut(`/api/categories/${editTarget.id}`, { name }), {
      key: mutationKey(editTarget.id, 'rename'),
      onSuccess: () => {
        setSuccessMsg(`Category renamed to "${name}".`);
        setEditTarget(null);
        loadCategories(false);
        refreshTabCounts();
      },
      onError: (msg) => setEditError(msg),
    });
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return;
    setArchiveError('');

    await run(() => apiPost(`/api/categories/${archiveTarget.id}/archive`), {
      key: mutationKey(archiveTarget.id, 'archive'),
      onSuccess: () => {
        setSuccessMsg(`Category "${archiveTarget.name}" archived.`);
        setArchiveTarget(null);
        loadCategories(false);
        refreshTabCounts();
      },
      onError: (msg) => setArchiveError(msg),
    });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError('');

    await run(() => apiDelete(`/api/categories?id=${deleteTarget.id}`), {
      key: mutationKey(deleteTarget.id, 'delete'),
      onSuccess: () => {
        setSuccessMsg(`Category "${deleteTarget.name}" deleted permanently.`);
        setDeleteTarget(null);
        setDeleteConfirmName('');
        loadCategories(false);
        refreshTabCounts();
      },
      onError: (msg) => setDeleteError(msg),
    });
  }

  async function handleRestore(category: CategoryListItem) {
    setErrorMsg('');
    setSuccessMsg('');

    await run(() => apiPost(`/api/categories/${category.id}/restore`), {
      key: mutationKey(category.id, 'restore'),
      onSuccess: () => {
        setSuccessMsg(`Category "${category.name}" restored.`);
        loadCategories(false);
        refreshTabCounts();
      },
      onError: (msg) => setErrorMsg(msg),
    });
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
      loadCategories(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCatId(null);
    }
  }

  async function handleRemoveImage(catId: string) {
    setErrorMsg('');
    setUploadingCatId(catId);
    try {
      const res = await fetch(`/api/categories/${catId}/image`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to remove category image');
        return;
      }
      setSuccessMsg('Category image removed.');
      loadCategories(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setUploadingCatId(null);
    }
  }

  function openEdit(cat: CategoryListItem) {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditError('');
  }

  function openArchive(cat: CategoryListItem) {
    setArchiveTarget(cat);
    setArchiveError('');
  }

  function openDelete(cat: CategoryListItem) {
    setDeleteTarget(cat);
    setDeleteConfirmName('');
    setDeleteError('');
  }

  const activeCount = tabCounts.active;
  const archivedCount = tabCounts.archived;

  return (
    <div className="space-y-6 w-full">
      <AdminPageHeader
        title="Categories"
        description="Manage product catalog categories and public catalog taxonomy."
        actions={
          <button onClick={() => loadCategories()} className="saas-btn-secondary gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-portal-danger-soft border border-portal-danger/30 text-xs text-portal-danger flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-portal-danger" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="p-0.5 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-portal-success-soft border border-portal-success/30 text-xs text-portal-success flex items-center gap-2.5 shadow-sm">
          <Check className="w-4 h-4 shrink-0 text-portal-success" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-0.5 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2 border-b border-portal-border pb-0">
        {(
          [
            { key: 'active' as StatusFilter, label: 'Active' },
            { key: 'archived' as StatusFilter, label: 'Archived' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`text-xs font-semibold px-4 py-2.5 border-b-2 -mb-px transition-colors ${
              statusFilter === tab.key
                ? 'border-portal-text text-portal-text'
                : 'border-transparent text-portal-muted hover:text-portal-text'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-portal-muted font-normal">
              ({tab.key === 'active' ? activeCount : archivedCount})
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {statusFilter === 'active' && (
          <form onSubmit={handleCreateCategory} className="lg:col-span-4 saas-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-portal-border pb-3">
              <Layers className="w-4 h-4 text-portal-text" />
              <h3 className="type-section">Add category</h3>
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

            <button
              type="submit"
              disabled={isPending('create-category')}
              className="saas-btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isPending('create-category') ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create Category</span>
            </button>
          </form>
        )}

        <div className={`saas-table-container ${statusFilter === 'active' ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          <table className="saas-table text-xs">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-16">Image</th>
                <th>Category name</th>
                <th className="w-24 text-center">Products</th>
                <th className="w-28">Created</th>
                <th className="text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-portal-muted">
                    Loading categories…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-portal-muted">
                    {statusFilter === 'active'
                      ? 'No active categories. Create one using the form.'
                      : 'No archived categories.'}
                  </td>
                </tr>
              ) : (
                categories.map((cat, idx) => {
                  const imageUrl = cat.imageUrl || cat.image_url;
                  const isUploading = uploadingCatId === cat.id;

                  return (
                    <tr key={cat.id}>
                      <td className="text-portal-muted">{idx + 1}</td>
                      <td>
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-portal-border"
                          />
                        ) : (
                          <span className="inline-flex w-10 h-10 rounded-lg bg-portal-inset border border-portal-border items-center justify-center text-[10px] text-portal-muted">
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-portal-text">{cat.name}</div>
                        {statusFilter === 'active' && (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCategoryImageUpload(cat.id, file);
                                e.target.value = '';
                              }}
                              className="text-[10px] max-w-[140px]"
                            />
                            {imageUrl && (
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(cat.id)}
                                disabled={isUploading}
                                className="text-[10px] text-portal-muted hover:text-portal-danger disabled:opacity-50"
                              >
                                {isUploading ? '…' : 'Remove'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center text-portal-muted">{cat.productCount}</td>
                      <td className="text-portal-muted">{formatDate(cat.created_at)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {statusFilter === 'active' ? (
                            <>
                              <button
                                onClick={() => openEdit(cat)}
                                className="p-1.5 rounded-lg text-portal-muted hover:bg-portal-hover hover:text-portal-text"
                                title="Rename"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openArchive(cat)}
                                disabled={isPending(mutationKey(cat.id, 'archive'))}
                                className="p-1.5 rounded-lg text-portal-warning hover:bg-portal-warning-soft disabled:opacity-50"
                                title="Archive"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              {cat.productCount === 0 && (
                                <button
                                  onClick={() => openDelete(cat)}
                                  className="p-1.5 rounded-lg text-portal-danger hover:bg-portal-danger-soft"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(cat)}
                                disabled={isPending(mutationKey(cat.id, 'restore'))}
                                className="p-1.5 rounded-lg text-portal-success hover:bg-portal-success-soft disabled:opacity-50"
                                title="Restore"
                              >
                                {isPending(mutationKey(cat.id, 'restore')) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {cat.productCount === 0 && (
                                <button
                                  onClick={() => openDelete(cat)}
                                  className="p-1.5 rounded-lg text-portal-danger hover:bg-portal-danger-soft"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <CategoryEditDialog
          category={editTarget}
          name={editName}
          onNameChange={setEditName}
          saving={isPending(mutationKey(editTarget.id, 'rename'))}
          error={editError}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {archiveTarget && (
        <CategoryArchiveDialog
          category={archiveTarget}
          archiving={isPending(mutationKey(archiveTarget.id, 'archive'))}
          error={archiveError}
          onClose={() => setArchiveTarget(null)}
          onConfirm={handleConfirmArchive}
        />
      )}

      {deleteTarget && (
        <CategoryDeleteDialog
          category={deleteTarget}
          confirmName={deleteConfirmName}
          onConfirmNameChange={setDeleteConfirmName}
          deleting={isPending(mutationKey(deleteTarget.id, 'delete'))}
          error={deleteError}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteConfirmName('');
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
