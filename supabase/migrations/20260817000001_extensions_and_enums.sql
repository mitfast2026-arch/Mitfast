-- Migration 001: Extensions and Domain Enums
-- MITFAST B2B Platform Architecture

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Clean drop of legacy temporary tables if any
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.rfq_items CASCADE;
DROP TABLE IF EXISTS public.rfqs CASCADE;
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
DROP TABLE IF EXISTS public.enquiries CASCADE;
DROP TABLE IF EXISTS public.product_approval_requests CASCADE;
DROP TABLE IF EXISTS public.product_specifications CASCADE;
DROP TABLE IF EXISTS public.product_images CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.customer_addresses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.business_settings CASCADE;

-- Clean drop of legacy types if any
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.rfq_status CASCADE;
DROP TYPE IF EXISTS public.enquiry_status CASCADE;
DROP TYPE IF EXISTS public.profit_type CASCADE;
DROP TYPE IF EXISTS public.product_archive_status CASCADE;
DROP TYPE IF EXISTS public.product_publication_status CASCADE;
DROP TYPE IF EXISTS public.product_approval_status CASCADE;
DROP TYPE IF EXISTS public.supplier_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Enum: User Role (Guest is not a DB role)
CREATE TYPE public.user_role AS ENUM ('admin', 'supplier', 'customer');

-- Enum: Supplier Status
CREATE TYPE public.supplier_status AS ENUM ('pending', 'active', 'rejected', 'archived');

-- Enum: Product Approval Status
CREATE TYPE public.product_approval_status AS ENUM ('pending', 'approved', 'rejected', 'update_pending');

-- Enum: Product Publication Status
CREATE TYPE public.product_publication_status AS ENUM ('published', 'unpublished');

-- Enum: Product Archive Status
CREATE TYPE public.product_archive_status AS ENUM ('active', 'archived');

-- Enum: Profit Configuration Type
CREATE TYPE public.profit_type AS ENUM ('percentage', 'fixed');

-- Enum: Enquiry Status
CREATE TYPE public.enquiry_status AS ENUM ('new', 'contacted', 'converted_to_order', 'closed');

-- Enum: RFQ Status
CREATE TYPE public.rfq_status AS ENUM ('submitted', 'under_review', 'accepted', 'rejected', 'converted_to_order');

-- Enum: Order Status (Non-linear operational workflow)
CREATE TYPE public.order_status AS ENUM ('accepted', 'packing', 'dispatched', 'cancelled');

-- Enum: Payment Status (Manual workflow)
CREATE TYPE public.payment_status AS ENUM ('payment_required', 'payment_done');
