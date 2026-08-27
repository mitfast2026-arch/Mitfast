-- Fix Tier 1/2 triggers: SECURITY DEFINER made current_user always postgres/supabase_admin,
-- so the bypass always fired and locks never ran for authenticated clients.
-- Use auth.role() / session_user instead.

CREATE OR REPLACE FUNCTION public.profiles_freeze_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT := coalesce(nullif(auth.role(), ''), session_user);
BEGIN
  IF v_actor IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role is immutable for client roles'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    RAISE EXCEPTION 'profiles.role cannot be set to admin by client roles'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.products_soft_lock_client_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT := coalesce(nullif(auth.role(), ''), session_user);
BEGIN
  IF v_actor IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  NEW.approval_status := 'pending';
  NEW.publication_status := 'unpublished';
  NEW.archive_status := COALESCE(NEW.archive_status, 'active');
  NEW.ribbon_label := NULL;
  NEW.is_draft := true;

  RETURN NEW;
END;
$$;

-- Also fix the UPDATE privileged-column guard from 040 (same DEFINER/current_user bug).
CREATE OR REPLACE FUNCTION public.products_block_privileged_client_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT := coalesce(nullif(auth.role(), ''), session_user);
BEGIN
  IF v_actor IN ('service_role', 'postgres', 'supabase_admin') THEN
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
