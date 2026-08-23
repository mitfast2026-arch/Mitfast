import { z } from 'zod';

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
  deliveryAddress: deliveryAddressInputSchema.optional(), // if omitted, uses customer's stored address
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
});
