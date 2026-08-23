import { createAdminClient } from '@/lib/supabase/admin';
import {
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
  listCategoriesQuerySchema,
} from '@/lib/validation/category.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { CategoryStatus } from '@/types/database';
import type { CategoryListItem } from '@/types/category';

type GetCategoriesOptions = {
  mode?: 'admin' | 'public';
  status?: 'active' | 'archived' | 'all';
};

async function enrichWithProductCounts(
  categories: Array<{ id: string; [key: string]: unknown }>
): Promise<Map<string, number>> {
  const adminClient = createAdminClient();
  const categoryIds = categories.map((c) => c.id);
  const countByCategory = new Map<string, number>();

  const { data: countRows } = await (adminClient as any).rpc('category_product_counts');

  if (countRows && Array.isArray(countRows)) {
    for (const row of countRows as { category_id: string; product_count: number }[]) {
      countByCategory.set(row.category_id, Number(row.product_count) || 0);
    }
  } else if (categoryIds.length > 0) {
    const { data: products } = await adminClient
      .from('products')
      .select('category_id')
      .in('category_id', categoryIds)
      .eq('archive_status', 'active');

    for (const product of products || []) {
      const key = product.category_id as string;
      countByCategory.set(key, (countByCategory.get(key) || 0) + 1);
    }
  }

  return countByCategory;
}

/**
 * Lists categories, enriched with productCount.
 * Public/default: active only. Admin mode can filter by status.
 */
export async function getCategories(
  options: GetCategoriesOptions = {}
): Promise<ServerResult<{ categories: CategoryListItem[] }>> {
  try {
    const parsed = listCategoriesQuerySchema.safeParse(options);
    if (!parsed.success) {
      return {
        success: false,
        error: { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { mode, status } = parsed.data;
    const adminClient = createAdminClient();

    let query = adminClient.from('categories').select('*').order('name', { ascending: true });

    if (mode === 'public') {
      query = query.eq('status', 'active');
    } else if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: categories, error } = await query;

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    if (!categories || categories.length === 0) {
      return { success: true, data: { categories: [] } };
    }

    const countByCategory = await enrichWithProductCounts(categories);

    const enriched: CategoryListItem[] = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      status: (cat.status as CategoryStatus) || 'active',
      archived_at: cat.archived_at ?? null,
      created_at: cat.created_at,
      image_url: cat.image_url ?? null,
      image_storage_path: cat.image_storage_path ?? null,
      productCount: countByCategory.get(cat.id) || 0,
      imageUrl: cat.image_url || null,
    }));

    return { success: true, data: { categories: enriched } };
  } catch (error) {
    console.error('[getCategories] Error:', error);
    return { success: false, error: { message: 'Failed to fetch categories', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin adds a new single-level category.
 */
export async function createCategory(formData: unknown): Promise<ServerResult<{ categoryId: string }>> {
  try {
    const validated = createCategorySchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { name } = validated.data;
    const adminClient = createAdminClient();

    const { data: category, error } = await adminClient
      .from('categories')
      .insert({ name, status: 'active' })
      .select()
      .single();

    if (error || !category) {
      return {
        success: false,
        error: { message: error?.message || 'Category already exists or could not be created', code: 'DATABASE_ERROR' },
      };
    }

    return { success: true, data: { categoryId: category.id } };
  } catch (error) {
    console.error('[createCategory] Error:', error);
    return { success: false, error: { message: 'Failed to create category', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin renames a category.
 */
export async function updateCategory(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = updateCategorySchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { categoryId, name } = validated.data;
    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } };
    }

    const { error } = await adminClient.from('categories').update({ name }).eq('id', categoryId);

    if (error) {
      return {
        success: false,
        error: { message: error.message || 'Category name already exists', code: 'DATABASE_ERROR' },
      };
    }

    return { success: true, data: { updated: true } };
  } catch (error) {
    console.error('[updateCategory] Error:', error);
    return { success: false, error: { message: 'Failed to update category', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin archives a category (soft remove). Allowed even when products are assigned.
 */
export async function archiveCategory(categoryId: string): Promise<ServerResult<{ archived: boolean }>> {
  try {
    const validated = categoryIdSchema.safeParse({ categoryId });
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from('categories')
      .select('id, status')
      .eq('id', categoryId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } };
    }

    if (existing.status === 'archived') {
      return { success: false, error: { message: 'Category is already archived', code: 'ALREADY_ARCHIVED' } };
    }

    const { error } = await adminClient
      .from('categories')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', categoryId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { archived: true } };
  } catch (error) {
    console.error('[archiveCategory] Error:', error);
    return { success: false, error: { message: 'Failed to archive category', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin restores an archived category.
 */
export async function restoreCategory(categoryId: string): Promise<ServerResult<{ restored: boolean }>> {
  try {
    const validated = categoryIdSchema.safeParse({ categoryId });
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from('categories')
      .select('id, status')
      .eq('id', categoryId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } };
    }

    if (existing.status === 'active') {
      return { success: false, error: { message: 'Category is already active', code: 'ALREADY_ACTIVE' } };
    }

    const { error } = await adminClient
      .from('categories')
      .update({ status: 'active', archived_at: null })
      .eq('id', categoryId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { restored: true } };
  } catch (error) {
    console.error('[restoreCategory] Error:', error);
    return { success: false, error: { message: 'Failed to restore category', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin hard-deletes a category (only when no products are assigned).
 */
export async function deleteCategory(formData: unknown): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const validated = deleteCategorySchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { categoryId } = validated.data;
    const adminClient = createAdminClient();

    const { count: productCount } = await adminClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (productCount && productCount > 0) {
      return {
        success: false,
        error: {
          message: `Cannot delete category: ${productCount} products are currently assigned to this category. Archive it instead, or reassign/delete the products first.`,
          code: 'CATEGORY_IN_USE',
        },
      };
    }

    const { error } = await adminClient.from('categories').delete().eq('id', categoryId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteCategory] Error:', error);
    return { success: false, error: { message: 'Failed to delete category', code: 'INTERNAL_ERROR' } };
  }
}
