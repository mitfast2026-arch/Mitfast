import { createAdminClient } from '@/lib/supabase/admin';
import { createCategorySchema, deleteCategorySchema } from '@/lib/validation/category.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';

/**
 * Lists all active categories, enriched with productCount.
 * Card imagery is resolved on the presentation layer from curated local assets.
 */
export async function getCategories(): Promise<ServerResult<{ categories: any[] }>> {
  try {
    const adminClient = createAdminClient();
    const { data: categories, error } = await adminClient
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    if (!categories || categories.length === 0) {
      return { success: true, data: { categories: [] } };
    }

    const categoryIds = categories.map((c) => c.id);

    const { data: countRows } = await (adminClient as any).rpc('category_product_counts');
    const countByCategory = new Map<string, number>();

    if (countRows && Array.isArray(countRows)) {
      for (const row of countRows as { category_id: string; product_count: number }[]) {
        countByCategory.set(row.category_id, Number(row.product_count) || 0);
      }
    } else {
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

    const enriched = categories.map((cat) => ({
      ...cat,
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
      .insert({ name })
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
 * Admin deletes a category (safeguards against deleting categories that contain products).
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

    // 1. Check if any products reference this category
    const { count: productCount } = await adminClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (productCount && productCount > 0) {
      return {
        success: false,
        error: {
          message: `Cannot delete category: ${productCount} products are currently assigned to this category. Please reassign or delete the products first.`,
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
