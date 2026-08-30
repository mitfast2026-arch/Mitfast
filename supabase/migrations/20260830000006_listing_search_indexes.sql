-- Migration 20260830000006_listing_search_indexes.sql
-- Optimized composite and trigram indexes for listing queries, server-side search, and customer/supplier lookups.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Profiles role + created_at composite index for fast paginated customer/user listings
CREATE INDEX IF NOT EXISTS idx_profiles_role_created_at
  ON public.profiles(role, created_at DESC);

-- 2. Trigram GIN indexes for fast server-side ILIKE search on customer profiles
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON public.profiles USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_phone_trgm
  ON public.profiles USING gin (phone gin_trgm_ops);

-- 3. Trigram GIN index for fast server-side ILIKE search on suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_email_trgm
  ON public.suppliers USING gin (email gin_trgm_ops);

-- 4. Products view_count index for popular products / view analytics
CREATE INDEX IF NOT EXISTS idx_products_view_count_desc
  ON public.products(view_count DESC);
