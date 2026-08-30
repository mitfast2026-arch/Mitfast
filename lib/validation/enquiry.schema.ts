import { z } from 'zod';
import { deliveryAddressInputSchema } from './rfq.schema';
import { requiredContactSchema } from './auth.schema';

function normalizeEnquiryContact(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const d = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const name = str(d.name) || str(d.guestName);
  const email = str(d.email) || str(d.guestEmail);
  const phone = str(d.phone) || str(d.guestPhone);

  return {
    ...d,
    name,
    email,
    phone,
    guestName: name,
    guestEmail: email,
    guestPhone: phone,
  };
}

export const createEnquirySchema = z.preprocess(
  normalizeEnquiryContact,
  z
    .object({
      name: requiredContactSchema.shape.fullName,
      email: requiredContactSchema.shape.email,
      phone: requiredContactSchema.shape.phone,
      guestName: z.string().min(2).optional(),
      guestEmail: z.string().email().optional(),
      guestPhone: z.string().min(7).optional(),
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
    })
);

export const updateEnquiryStatusSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  status: z.enum(['new', 'contacted', 'converted_to_rfq', 'converted_to_order', 'closed']),
});

export const updateEnquiryDetailsSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  guestName: requiredContactSchema.shape.fullName.optional(),
  guestEmail: requiredContactSchema.shape.email.optional(),
  guestPhone: requiredContactSchema.shape.phone.optional(),
  country: z.string().min(2).optional(),
  companyName: z.string().optional().nullable(),
  message: z.string().min(1).optional(),
  enquiryType: z.string().optional(),
  productId: z.string().uuid('Invalid product ID').optional().nullable(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().uuid().optional().nullable(),
        name: z.string().optional().nullable(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
});

export const respondToEnquirySchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  responseMessage: z.string().min(1, 'Response message is required').max(5000),
  status: z.enum(['contacted', 'closed']).optional(),
});

export const convertEnquiryToRfqSchema = z.object({
  enquiryId: z.string().uuid('Invalid enquiry ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  productId: z.string().uuid('Invalid product ID').optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1)
    .optional(),
  deliveryAddress: deliveryAddressInputSchema.optional(),
});
