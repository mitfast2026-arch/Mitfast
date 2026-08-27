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
