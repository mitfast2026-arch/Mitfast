-- Performance indexes and supplier stats aggregation for scale.

CREATE INDEX IF NOT EXISTS enquiries_product_id_idx ON enquiries (product_id);

CREATE INDEX IF NOT EXISTS orders_rfq_id_idx ON orders (rfq_id);

CREATE INDEX IF NOT EXISTS orders_enquiry_id_idx ON orders (enquiry_id);

CREATE INDEX IF NOT EXISTS par_status_type_created_idx
  ON product_approval_requests (status, request_type, created_at DESC);

CREATE INDEX IF NOT EXISTS products_supplier_archive_idx
  ON products (supplier_id, archive_status);

-- Aggregated demand stats per supplier product (replaces N+1 count loops).
CREATE OR REPLACE FUNCTION public.supplier_product_demand_stats(p_supplier_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  views bigint,
  enquiries bigint,
  rfqs bigint,
  orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(p.view_count, 0)::bigint AS views,
    COALESCE(e.cnt, 0)::bigint AS enquiries,
    COALESCE(r.cnt, 0)::bigint AS rfqs,
    COALESCE(o.cnt, 0)::bigint AS orders
  FROM products p
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM enquiries
    GROUP BY product_id
  ) e ON e.product_id = p.id
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM rfq_items
    GROUP BY product_id
  ) r ON r.product_id = p.id
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM order_items
    GROUP BY product_id
  ) o ON o.product_id = p.id
  WHERE p.supplier_id = p_supplier_id;
$$;

-- Category product counts (active products only).
CREATE OR REPLACE FUNCTION public.category_product_counts()
RETURNS TABLE (category_id uuid, product_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category_id, COUNT(*)::bigint AS product_count
  FROM products
  WHERE archive_status = 'active'
  GROUP BY category_id;
$$;
