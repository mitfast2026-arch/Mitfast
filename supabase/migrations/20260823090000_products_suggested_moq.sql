-- Supplier-suggested MOQ; catalog `moq` remains admin-controlled.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS suggested_moq integer
  CHECK (suggested_moq IS NULL OR suggested_moq > 0);

COMMENT ON COLUMN public.products.suggested_moq IS
  'Supplier-suggested MOQ; catalog moq is set by admin.';

UPDATE public.products
SET suggested_moq = moq
WHERE suggested_moq IS NULL;
