import { z } from 'zod';

export const specificationItemSchema = z.object({
  spec_name: z.string().min(1, 'Specification name is required'),
  spec_value: z.string().min(1, 'Specification value is required'),
  sort_order: z.number().int().default(0),
});

const optionalSupplierId = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional();

const createProductBaseSchema = z.object({
  categoryId: z.string().uuid('Valid category is required'),
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1, 'MOQ must be at least 1').optional(),
  suggestedMoq: z.number().int().min(1, 'Suggested MOQ must be at least 1').optional(),
  supplierPrice: z.number().min(0, 'Supplier price must be non-negative'),
  gstRate: z.number().min(0).max(100).optional(),
  gstIncluded: z.boolean().optional(),
  discount: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  profitType: z.enum(['percentage', 'fixed']).optional(),
  profitValue: z.number().min(0).optional(),
  ribbonLabel: z.string().nullable().optional(),
  specifications: z.array(specificationItemSchema).default([]),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8, 'Maximum 8 images allowed').default([]),
  isDraft: z.boolean().optional(),
});

/** Supplier create — suggested MOQ or catalog MOQ required. */
export const createProductSchema = createProductBaseSchema.superRefine((data, ctx) => {
  if (data.moq == null && data.suggestedMoq == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Suggested MOQ is required',
      path: ['suggestedMoq'],
    });
  }
});

/** Admin creates a product; supplier is optional (internal product when omitted). */
export const createProductByAdminSchema = createProductBaseSchema
  .extend({
    supplierId: optionalSupplierId,
  })
  .superRefine((data, ctx) => {
    if (data.moq == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Catalog MOQ must be at least 1',
        path: ['moq'],
      });
    }
  });

/** Relaxed validation for admin draft saves. */
export const saveProductDraftSchema = z.object({
  productId: z.string().uuid().optional(),
  supplierId: optionalSupplierId,
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1).optional(),
  suggestedMoq: z.number().int().min(1).optional(),
  supplierPrice: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  gstIncluded: z.boolean().optional(),
  discount: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  profitType: z.enum(['percentage', 'fixed']).optional(),
  profitValue: z.number().min(0).optional(),
  ribbonLabel: z.string().nullable().optional(),
  specifications: z.array(specificationItemSchema).optional(),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8).optional(),
  isDraft: z.literal(true),
});

export const updateProductBySupplierSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  name: z.string().min(2, 'Product name is required'),
  categoryId: z.string().uuid('Valid category is required'),
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  suggestedMoq: z.number().int().min(1, 'Suggested MOQ must be at least 1'),
  supplierPrice: z.number().min(0, 'Supplier price must be non-negative'),
  specifications: z.array(specificationItemSchema).optional(),
  imageUrls: z.array(z.string().url('Invalid image URL')).max(8, 'Maximum 8 images allowed').optional(),
});

export const adminUpdateProductSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  name: z.string().min(2, 'Product name is required').optional(),
  categoryId: z.string().uuid('Valid category is required').optional(),
  supplierId: optionalSupplierId,
  description: z.string().optional(),
  sku: z.string().max(64).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  moq: z.number().int().min(1, 'MOQ must be at least 1').optional(),
  suggestedMoq: z.number().int().min(1).optional().nullable(),
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
  isDraft: z.boolean().optional(),
  forceApply: z.boolean().optional(),
});

export const rejectProductSchema = z.object({
  requestId: z.string().uuid('Invalid approval request ID'),
  rejectionReason: z.string().min(3, 'Rejection reason is required'),
});

export const requestChangesSchema = z.object({
  requestId: z.string().uuid('Invalid approval request ID'),
  reviewNote: z.string().min(3, 'Please describe the requested changes'),
});
