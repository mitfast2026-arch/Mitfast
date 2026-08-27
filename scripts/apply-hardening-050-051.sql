-- Paste into Supabase SQL Editor for project qubphaacuuwlpdrsprjl
-- Then run: npm run test:hardening-smoke
-- Combined from migrations 050 + 051

-- Ultra-safe Tier 1: freeze profiles.role for non-privileged DB roles.
-- Does not change handle_new_user signup flow. Service role can still promote admins.

CREATE OR REPLACE FUNCTION public.profiles_freeze_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role is immutable for client roles'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Client inserts must not self-assign admin (defense in depth; trigger usually creates rows).
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'profiles.role cannot be set to admin by client roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_freeze_role ON public.profiles;
CREATE TRIGGER trg_profiles_freeze_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_freeze_role();


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

