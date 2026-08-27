-- ============================================================
-- MITFAST Safe Performance Optimizations Migration
-- Project: qubphaacuuwlpdrsprjl
-- Safe, additive-only improvements: no destructive drops, no RLS disabled.
-- ============================================================

-- 1. Atomic View Counter RPC (fixes view_count resetting to 1)
CREATE OR REPLACE FUNCTION public.increment_product_view(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.products
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_id;
$$;

-- 2. Deterministic, collision-free Order Number Sequence & Generator
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

-- 3. Deterministic, collision-free RFQ Number Sequence & Generator
CREATE SEQUENCE IF NOT EXISTS public.rfq_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_rfq_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'RFQ-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(nextval('public.rfq_number_seq')::text, 4, '0');
$$;

-- 4. Storefront Category + Price Composite Index for fast filtered browsing
CREATE INDEX IF NOT EXISTS products_storefront_category_idx
  ON public.products (publication_status, archive_status, approval_status, category_id, selling_price)
  WHERE archive_status = 'active';

-- 5. SKU Trigram index for fast instantaneous search
CREATE INDEX IF NOT EXISTS products_sku_trgm
  ON public.products USING gin(sku gin_trgm_ops)
  WHERE sku IS NOT NULL;

-- 6. CTE-Optimized Supplier Product Demand Stats RPC
DROP FUNCTION IF EXISTS public.supplier_product_demand_stats(uuid);
CREATE OR REPLACE FUNCTION public.supplier_product_demand_stats(p_supplier_id uuid)
RETURNS TABLE (
  product_id   uuid,
  product_name text,
  enquiry_count bigint,
  rfq_count    bigint,
  order_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH supplier_products AS (
    SELECT id, name
    FROM public.products
    WHERE supplier_id = p_supplier_id
  ),
  enq_counts AS (
    SELECT product_id, COUNT(*) AS cnt
    FROM public.enquiries
    WHERE product_id IN (SELECT id FROM supplier_products)
    GROUP BY product_id
  ),
  rfq_counts AS (
    SELECT ri.product_id, COUNT(*) AS cnt
    FROM public.rfq_items ri
    JOIN public.rfqs r ON r.id = ri.rfq_id
    WHERE ri.product_id IN (SELECT id FROM supplier_products)
    GROUP BY ri.product_id
  ),
  ord_counts AS (
    SELECT oi.product_id, COUNT(*) AS cnt
    FROM public.order_items oi
    WHERE oi.product_id IN (SELECT id FROM supplier_products)
    GROUP BY oi.product_id
  )
  SELECT
    sp.id AS product_id,
    sp.name AS product_name,
    COALESCE(e.cnt, 0) AS enquiry_count,
    COALESCE(r.cnt, 0) AS rfq_count,
    COALESCE(o.cnt, 0) AS order_count
  FROM supplier_products sp
  LEFT JOIN enq_counts e ON e.product_id = sp.id
  LEFT JOIN rfq_counts r ON r.product_id = sp.id
  LEFT JOIN ord_counts o ON o.product_id = sp.id
  ORDER BY (COALESCE(e.cnt, 0) + COALESCE(r.cnt, 0) + COALESCE(o.cnt, 0)) DESC;
$$;
