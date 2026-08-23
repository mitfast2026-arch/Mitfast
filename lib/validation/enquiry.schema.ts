import { z } from 'zod';
import { deliveryAddressInputSchema } from './rfq.schema';

export const createEnquirySchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  guestName: z.string().min(2, 'Guest name is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  guestEmail: z.string().email('Valid email is required').optional(),
  phone: z.string().min(7, 'Phone number is required').optional(),
  guestPhone: z.string().min(7, 'Phone number is required').optional(),
  country: z.string().min(2, 'Country is required').optional(),
  companyName: z.string().optional(),
  enquiryType: z.string().optional(),
  productId: z.string().uuid('Invalid product ID').optional().nullable(),
  message: z.string().min(5, 'Message must be at least 5 characters'),
  lineItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        name: z.string().optional(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
  /** @deprecated Use multipart attachment upload instead of drawingUrl in message. */
  drawingUrl: z.string().url('Invalid drawing URL').optional().or(z.literal('')),
}).refine(data => (data.name || data.guestName), {
  message: 'Name is required',
  path: ['name'],
}).refine(data => (data.email || data.guestEmail), {
  message: 'Valid email is required',
  path: ['email'],
}).refine(data => (data.phone || data.guestPhone), {
  message: 'Phone number is required',
  path: ['phone'],
});

export const updateEnquiryStatusSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  status: z.enum(['new', 'contacted', 'converted_to_rfq', 'converted_to_order', 'closed']),
});

export const updateEnquiryDetailsSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  guestName: z.string().min(2).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(7).optional(),
  country: z.string().min(2).optional(),
  companyName: z.string().optional().nullable(),
});

export const respondToEnquirySchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  responseMessage: z.string().min(1, 'Response message is required').max(5000),
  status: z.enum(['contacted', 'closed']).optional(),
});

export const convertEnquiryToRfqSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  productId: z.string().uuid('Invalid product ID').optional(),
  deliveryAddress: deliveryAddressInputSchema.optional(),
});
