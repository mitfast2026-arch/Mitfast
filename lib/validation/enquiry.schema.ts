import { z } from 'zod';

export const createEnquirySchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  guestName: z.string().min(2, 'Guest name is required').optional(),
  email: z.string().email('Valid email is required').optional(),
  guestEmail: z.string().email('Valid email is required').optional(),
  phone: z.string().min(7, 'Phone number is required').optional(),
  guestPhone: z.string().min(7, 'Phone number is required').optional(),
  productId: z.string().uuid('Invalid product ID').optional().nullable(),
  message: z.string().min(5, 'Message must be at least 5 characters'),
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
  status: z.enum(['new', 'contacted', 'converted_to_order', 'closed']),
});

export const respondToEnquirySchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  responseMessage: z.string().min(1, 'Response message is required').max(5000),
  status: z.enum(['contacted', 'closed']).optional(),
});
