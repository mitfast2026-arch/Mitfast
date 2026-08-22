-- Role lock: never assign admin from user-editable signup metadata.
-- Catalog and profile lookup indexes.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  assigned_role public.user_role := 'customer';
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'role' = 'supplier' THEN
    assigned_role := 'supplier'::public.user_role;
  ELSE
    assigned_role := 'customer'::public.user_role;
  END IF;

  INSERT INTO public.profiles (user_id, role, full_name, email, phone)
  VALUES (
    NEW.id,
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS products_storefront_idx
  ON products (publication_status, archive_status, approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS carts_customer_id_idx
  ON carts (customer_id);

CREATE INDEX IF NOT EXISTS profiles_email_role_idx
  ON profiles (email, role);
