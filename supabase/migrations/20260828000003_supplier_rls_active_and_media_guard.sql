-- Tighten supplier RLS: require active supplier status for product-related writes.
-- Also freeze approval-request status on client INSERT.

-- Products: only active suppliers may insert
DROP POLICY IF EXISTS "products_supplier_insert" ON public.products;
CREATE POLICY "products_supplier_insert"
  ON public.products FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM public.suppliers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Product images: only active suppliers, not on published parent products
DROP POLICY IF EXISTS "product_images_supplier_insert" ON public.product_images;
CREATE POLICY "product_images_supplier_insert"
  ON public.product_images FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      INNER JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND p.publication_status <> 'published'
    )
  );

DROP POLICY IF EXISTS "product_images_supplier_delete" ON public.product_images;
CREATE POLICY "product_images_supplier_delete"
  ON public.product_images FOR DELETE
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      INNER JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND p.publication_status <> 'published'
    )
  );

-- Product specifications: same guard as images
DROP POLICY IF EXISTS "product_specs_supplier_insert" ON public.product_specifications;
CREATE POLICY "product_specs_supplier_insert"
  ON public.product_specifications FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      INNER JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND p.publication_status <> 'published'
    )
  );

DROP POLICY IF EXISTS "product_specs_supplier_delete" ON public.product_specifications;
CREATE POLICY "product_specs_supplier_delete"
  ON public.product_specifications FOR DELETE
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      INNER JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE s.user_id = auth.uid()
        AND s.status = 'active'
        AND p.publication_status <> 'published'
    )
  );

-- Approval requests: suppliers may only insert open-queue statuses
CREATE OR REPLACE FUNCTION public.par_freeze_client_insert_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pending', 'update_pending') THEN
    RAISE EXCEPTION 'Suppliers cannot set approval request status to %', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS par_freeze_client_insert_status ON public.product_approval_requests;
CREATE TRIGGER par_freeze_client_insert_status
  BEFORE INSERT ON public.product_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.par_freeze_client_insert_status();

-- Approval requests: only active suppliers may insert for own products
DROP POLICY IF EXISTS "par_supplier_insert_own" ON public.product_approval_requests;
CREATE POLICY "par_supplier_insert_own"
  ON public.product_approval_requests FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      INNER JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE s.user_id = auth.uid() AND s.status = 'active'
    )
  );
