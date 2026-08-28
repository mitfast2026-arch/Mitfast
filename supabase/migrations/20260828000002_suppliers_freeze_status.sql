-- Prevent suppliers from self-activating via client UPDATE (AUTH-RLS-001).
-- Mirrors profiles_freeze_role pattern from 20260827000052_fix_trigger_actor_checks.sql.

CREATE OR REPLACE FUNCTION public.suppliers_freeze_status()
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

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'suppliers.status cannot be changed by client roles'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_freeze_status ON public.suppliers;
CREATE TRIGGER trg_suppliers_freeze_status
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.suppliers_freeze_status();
