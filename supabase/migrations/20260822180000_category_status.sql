-- Migration: Category archive status
-- Adds soft-archive support for product categories

CREATE TYPE public.category_status AS ENUM ('active', 'archived');

ALTER TABLE public.categories
  ADD COLUMN status public.category_status NOT NULL DEFAULT 'active',
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX categories_status_idx ON public.categories(status);
