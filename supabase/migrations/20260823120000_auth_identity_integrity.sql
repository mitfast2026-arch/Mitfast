-- Auth multi-login integrity (project qubphaacuuwlpdrsprjl only)
-- Harden suppliers.user_id and email uniqueness without new tables.

-- One supplier business row per auth user
ALTER TABLE public.suppliers
  ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_user_id_unique_idx
  ON public.suppliers (user_id);

-- Case-insensitive unique emails on profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique_idx
  ON public.profiles (lower(email));

-- One active/pending/rejected supplier email (archived may reuse later)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_email_lower_active_unique_idx
  ON public.suppliers (lower(email))
  WHERE status <> 'archived';
