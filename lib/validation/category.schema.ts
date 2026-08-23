import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
});

export const updateCategorySchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(2, 'Category name must be at least 2 characters'),
});

export const deleteCategorySchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
});

export const categoryIdSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
});

export const listCategoriesQuerySchema = z.object({
  mode: z.enum(['admin', 'public']).optional().default('public'),
  status: z.enum(['active', 'archived', 'all']).optional().default('active'),
});
