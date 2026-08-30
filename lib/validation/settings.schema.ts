import { z } from 'zod';

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const updateBusinessSettingsSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').optional(),
  logoUrl: z.preprocess(emptyToNull, z.string().url('Invalid logo URL').nullable().optional()),
  productsBannerUrl: z.preprocess(emptyToNull, z.string().url('Invalid banner URL').nullable().optional()),
  businessEmail: z.preprocess(emptyToNull, z.string().email('Invalid email address').nullable().optional()),
  businessPhone: z.preprocess(emptyToNull, z.string().min(7, 'Invalid phone number').nullable().optional()),
  businessAddress: z.preprocess(emptyToNull, z.string().nullable().optional()),
  website: z.preprocess(emptyToNull, z.string().url('Invalid website URL').nullable().optional()),
  minimumRfqValue: z.number().min(0, 'Minimum RFQ value must be non-negative').optional(),
  currency: z.string().min(3).max(3, 'Currency code must be a 3-letter ISO code (e.g. INR, USD)').optional(),
  maxProductImages: z.number().int().min(1).max(20).optional(),
  supplierApprovalRequired: z.boolean().optional(),
  productApprovalRequired: z.boolean().optional(),
  googleLoginEnabled: z.boolean().optional(),
});
