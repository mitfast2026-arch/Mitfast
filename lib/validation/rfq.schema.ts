import { z } from 'zod';
import { requiredContactSchema } from './auth.schema';

export const deliveryAddressInputSchema = z.object({
  address_line_1: z.string().min(2, 'Address Line 1 is required'),
  address_line_2: z.string().optional().nullable(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
  country: z.string().default('India'),
});

export const submitRfqSchema = z.object({
  customerMessage: z.string().optional(),
  deliveryAddress: deliveryAddressInputSchema.optional(),
  /** Optional — updates buyer profile before RFQ when provided */
  contact: requiredContactSchema.optional(),
});

export const negotiateRfqItemSchema = z.object({
  rfqItemId: z.string().uuid('Invalid RFQ item ID'),
  finalQuantity: z.number().int().min(1, 'Quantity must be at least 1'),
  /** Optional: when omitted (e.g. supplier quantity negotiate), existing DB price is kept. */
  finalUnitPrice: z.number().min(0, 'Unit price must be non-negative').optional(),
});

export const negotiateRfqSchema = z.object({
  rfqId: z.string().uuid('Invalid RFQ ID'),
  items: z.array(negotiateRfqItemSchema).min(1, 'At least one item required for negotiation'),
});

export const rejectRfqSchema = z.object({
  rfqId: z.string().uuid('Invalid RFQ ID'),
  rejectionReason: z.string().min(3, 'Rejection reason is required'),
});

export const updateRfqContactSchema = z.object({
  rfqId: z.string().uuid('Invalid RFQ ID'),
  deliveryAddress: deliveryAddressInputSchema.optional(),
  customerMessage: z.string().optional().nullable(),
  contact: requiredContactSchema.partial().optional(),
});

export const editRfqItemSchema = z.object({
  id: z.string().uuid('Invalid RFQ item ID').optional(),
  productId: z.string().uuid('Invalid product ID').optional().nullable(),
  productNameSnapshot: z.string().optional(),
  originalQuantity: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  originalUnitPrice: z.number().min(0, 'Unit price must be non-negative').optional(),
  unitPrice: z.number().min(0, 'Unit price must be non-negative').optional(),
  finalQuantity: z.number().int().min(1, 'Final quantity must be at least 1').optional().nullable(),
  finalUnitPrice: z.number().min(0, 'Final unit price must be non-negative').optional().nullable(),
});

export const editRfqSchema = z.object({
  rfqId: z.string().uuid('Invalid RFQ ID'),
  items: z.array(editRfqItemSchema).min(1, 'RFQ must contain at least one product line'),
  deliveryAddress: deliveryAddressInputSchema.optional(),
  customerMessage: z.string().optional().nullable(),
  contact: requiredContactSchema.partial().optional(),
});
