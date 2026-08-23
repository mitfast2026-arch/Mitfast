-- Bulk supplier summary metrics for admin supplier list dashboard.

CREATE OR REPLACE FUNCTION public.supplier_admin_summary_stats(p_supplier_ids uuid[])
RETURNS TABLE (
  supplier_id uuid,
  product_count bigint,
  total_views bigint,
  total_enquiries bigint,
  total_rfqs bigint,
  total_orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS supplier_id,
    COALESCE(p.product_count, 0)::bigint AS product_count,
    COALESCE(p.total_views, 0)::bigint AS total_views,
    COALESCE(p.total_enquiries, 0)::bigint AS total_enquiries,
    COALESCE(p.total_rfqs, 0)::bigint AS total_rfqs,
    COALESCE(p.total_orders, 0)::bigint AS total_orders
  FROM unnest(p_supplier_ids) AS s(id)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT pr.id)::bigint AS product_count,
      COALESCE(SUM(pr.view_count), 0)::bigint AS total_views,
      COALESCE(SUM(e.cnt), 0)::bigint AS total_enquiries,
      COALESCE(SUM(r.cnt), 0)::bigint AS total_rfqs,
      COALESCE(SUM(o.cnt), 0)::bigint AS total_orders
    FROM products pr
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS cnt
      FROM enquiries
      GROUP BY product_id
    ) e ON e.product_id = pr.id
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS cnt
      FROM rfq_items
      GROUP BY product_id
    ) r ON r.product_id = pr.id
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS cnt
      FROM order_items
      GROUP BY product_id
    ) o ON o.product_id = pr.id
    WHERE pr.supplier_id = s.id
  ) p ON true;
$$;
