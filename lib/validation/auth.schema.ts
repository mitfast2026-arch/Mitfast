import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const customerRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Valid phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  addressLine1: z.string().min(3, 'Delivery address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(4, 'Postal code is required'),
  country: z.string().default('India'),
});

export const supplierRegisterSchema = z.object({
  contactPerson: z.string().min(2, 'Contact person name is required'),
  companyName: z.string().min(2, 'Company name is required'),
  email: z.string().email('Valid business email is required'),
  phone: z.string().min(7, 'Phone number is required'),
  country: z.string().min(2, 'Country is required'),
  address: z.string().min(5, 'Plant / facility address is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm password is required'),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept terms and conditions'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').optional(),
  phone: z.string().min(7, 'Phone number is required').optional(),
  email: z.string().email('Invalid email address').optional(),
});
