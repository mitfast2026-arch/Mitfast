-- Restrict supplier direct UPDATE on products (close RLS bypass of approval/publish/pricing).
-- All privileged catalog mutations must go through service-role APIs.

DROP POLICY IF EXISTS "products_supplier_update_own" ON public.products;

-- Deny authenticated UPDATE on products entirely (service_role bypasses RLS).
-- Suppliers mutate via approval-request / image APIs that use the admin client.

CREATE OR REPLACE FUNCTION public.products_block_privileged_client_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Defense in depth if a permissive UPDATE policy is re-added later.
  -- service_role / postgres sessions are not subject to RLS; this trigger still
  -- runs for all roles — skip when current_user is service_role or postgres.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.publication_status IS DISTINCT FROM OLD.publication_status
     OR NEW.archive_status IS DISTINCT FROM OLD.archive_status
     OR NEW.selling_price IS DISTINCT FROM OLD.selling_price
     OR NEW.profit_type IS DISTINCT FROM OLD.profit_type
     OR NEW.profit_value IS DISTINCT FROM OLD.profit_value
     OR NEW.discount IS DISTINCT FROM OLD.discount
     OR NEW.gst_rate IS DISTINCT FROM OLD.gst_rate
     OR NEW.gst_included IS DISTINCT FROM OLD.gst_included
     OR NEW.moq IS DISTINCT FROM OLD.moq
     OR NEW.min_order_value IS DISTINCT FROM OLD.min_order_value
     OR NEW.ribbon_label IS DISTINCT FROM OLD.ribbon_label
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.supplier_price IS DISTINCT FROM OLD.supplier_price
  THEN
    RAISE EXCEPTION 'Privileged product fields cannot be updated by client roles'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_block_privileged_client_update ON public.products;
CREATE TRIGGER trg_products_block_privileged_client_update
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_block_privileged_client_update();
