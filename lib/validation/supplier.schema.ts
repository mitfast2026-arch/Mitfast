import { z } from 'zod';

export const createSupplierByAdminSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Phone number is required'),
  address: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

export const updateSupplierProfileSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').optional(),
  contactPerson: z.string().min(2, 'Contact person is required').optional(),
  phone: z.string().min(7, 'Phone number is required').optional(),
  address: z.string().optional(),
  country: z.string().min(2, 'Country is required').optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

export const rejectSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  rejectionReason: z.string().min(3, 'Rejection reason is required'),
});

export const restoreSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  restoreAllProducts: z.boolean().default(true),
  selectedProductIds: z.array(z.string().uuid()).optional(),
});
