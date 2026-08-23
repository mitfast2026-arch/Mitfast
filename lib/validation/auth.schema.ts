import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/** Buyer/customer identity after Google or email OTP (no password). */
export const completeProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  email: z.string().email('Invalid email address').optional(),
});

/** @deprecated Password signup removed for public buyers; kept for type compatibility. */
export const customerRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Valid phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  addressLine1: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  postalCode: z.string().min(4).optional(),
  country: z.string().default('India'),
});

/** Supplier company application after auth session exists (no password). */
export const supplierApplicationSchema = z.object({
  contactPerson: z.string().min(2, 'Contact person name is required'),
  companyName: z.string().min(2, 'Company name is required'),
  phone: z.string().min(7, 'Phone number is required'),
  country: z.string().min(2, 'Country is required'),
  address: z.string().min(5, 'Plant / facility address is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  termsAccepted: z.boolean().refine((val) => val === true, 'You must accept terms and conditions'),
});

/** @deprecated Password supplier signup removed; use supplierApplicationSchema after OTP/Google. */
export const supplierRegisterSchema = supplierApplicationSchema
  .extend({
    email: z.string().email('Valid business email is required').optional(),
    password: z.string().min(6).optional(),
    confirmPassword: z.string().min(6).optional(),
  });

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').optional(),
  phone: z.string().min(7, 'Phone number is required').optional(),
  email: z.string().email('Invalid email address').optional(),
});
