import { z } from 'zod';
import { deliveryAddressInputSchema } from './rfq.schema';

export const createManualOrderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  gstRate: z.number().min(0).max(100).optional(),
  gstIncluded: z.boolean().optional(),
  discount: z.number().min(0).default(0),
});

export const createManualOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  deliveryAddress: deliveryAddressInputSchema,
  items: z.array(createManualOrderItemSchema).min(1, 'At least one item is required'),
});

export const convertRfqToOrderSchema = z.object({
  rfqId: z.string().uuid('Invalid RFQ ID'),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  status: z.enum(['accepted', 'packing', 'dispatched', 'cancelled']),
});

export const updatePaymentStatusSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  paymentStatus: z.enum(['payment_required', 'payment_done']),
});

export const editOrderSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  deliveryAddress: deliveryAddressInputSchema.optional(),
  items: z.array(z.object({
    orderItemId: z.string().uuid('Invalid order item ID'),
    productId: z.string().uuid('Invalid product ID').optional(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    gstRate: z.number().min(0).max(100).optional(),
    gstIncluded: z.boolean().optional(),
    discount: z.number().min(0).default(0),
  })).min(1, 'At least one item required'),
});
