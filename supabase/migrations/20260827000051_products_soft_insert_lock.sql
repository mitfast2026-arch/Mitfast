-- Ultra-safe Tier 2: soft product INSERT lock for non-privileged roles.
-- Does NOT drop products_supplier_insert. Forces pending/unpublished and
-- resets privileged columns so client inserts cannot publish/approve/bypass pricing.

CREATE OR REPLACE FUNCTION public.products_soft_lock_client_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  NEW.approval_status := 'pending';
  NEW.publication_status := 'unpublished';
  NEW.archive_status := COALESCE(NEW.archive_status, 'active');

  -- Strip storefront/admin presentation; cannot list without approval.
  NEW.ribbon_label := NULL;
  NEW.is_draft := true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_soft_lock_client_insert ON public.products;
CREATE TRIGGER trg_products_soft_lock_client_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_soft_lock_client_insert();
