import { z } from 'zod';

export const specificationItemSchema = z.object({
  spec_name: z.string().min(1, 'Specification name is required'),
  spec_value: z.string().min(1, 'Specification value is required'),
  sort_order: z.number().int().default(0),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Valid category is required'),
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1, 'MOQ must be at least 1'),
  supplierPrice: z.number().min(0, 'Supplier price must be non-negative'),
  gstRate: z.number().min(0).max(100).optional(),
  gstIncluded: z.boolean().optional(),
  discount: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  specifications: z.array(specificationItemSchema).default([]),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8, 'Maximum 8 images allowed').default([]),
});

/** Admin creates a product and assigns an existing supplier. */
export const createProductByAdminSchema = createProductSchema.extend({
  supplierId: z.string().uuid('Valid supplier is required'),
});

export const updateProductBySupplierSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  name: z.string().min(2, 'Product name is required'),
  categoryId: z.string().uuid('Valid category is required'),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1, 'MOQ must be at least 1'),
  supplierPrice: z.number().min(0, 'Supplier price must be non-negative'),
  gstRate: z.number().min(0).max(100).optional(),
  gstIncluded: z.boolean().optional(),
  discount: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  specifications: z.array(specificationItemSchema).optional(),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8, 'Maximum 8 images allowed').optional(),
});

export const adminUpdateProductSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  name: z.string().min(2, 'Product name is required').optional(),
  categoryId: z.string().uuid('Valid category is required').optional(),
  supplierId: z.string().uuid('Valid supplier is required').optional(),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1, 'MOQ must be at least 1').optional(),
  supplierPrice: z.number().min(0, 'Supplier price must be non-negative').optional(),
  profitType: z.enum(['percentage', 'fixed']).optional(),
  profitValue: z.number().min(0, 'Profit value must be non-negative').optional(),
  discount: z.number().min(0, 'Discount must be non-negative').optional(),
  gstRate: z.number().min(0).max(100, 'GST rate must be between 0 and 100').optional(),
  gstIncluded: z.boolean().optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  ribbonLabel: z.string().nullable().optional(),
  specifications: z.array(specificationItemSchema).optional(),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8, 'Maximum 8 images allowed').optional(),
});

export const rejectProductSchema = z.object({
  requestId: z.string().uuid('Invalid approval request ID'),
  rejectionReason: z.string().min(3, 'Rejection reason is required'),
});
