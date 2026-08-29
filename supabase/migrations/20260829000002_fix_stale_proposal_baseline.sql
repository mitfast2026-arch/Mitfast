-- Fix submit_supplier_update_atomic: preserve product updated_at baseline so proposals are not falsely marked stale

CREATE OR REPLACE FUNCTION public.submit_supplier_update_atomic(
  p_supplier_id UUID,
  p_product_id UUID,
  p_proposed JSONB,
  p_base_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_updated_at TIMESTAMPTZ;
  v_request_id UUID;
BEGIN
  IF p_supplier_id IS NULL OR p_product_id IS NULL OR p_proposed IS NULL THEN
    RAISE EXCEPTION 'supplier_id, product_id, and proposed data are required'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT supplier_id, updated_at
  INTO v_owner, v_updated_at
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner IS DISTINCT FROM p_supplier_id THEN
    RAISE EXCEPTION 'Product does not belong to this supplier' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.product_approval_requests
  SET
    status = 'rejected',
    rejection_reason = 'Superseded by newer submission',
    reviewed_at = now()
  WHERE product_id = p_product_id
    AND status IN ('pending', 'update_pending');

  BEGIN
    INSERT INTO public.product_approval_requests (
      product_id,
      request_type,
      proposed_data,
      status,
      base_product_updated_at
    )
    VALUES (
      p_product_id,
      'update',
      p_proposed,
      'update_pending',
      v_updated_at
    )
    RETURNING id INTO v_request_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'OPEN_REQUEST_EXISTS' USING ERRCODE = 'unique_violation';
  END;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_supplier_update_atomic(UUID, UUID, JSONB, TIMESTAMPTZ) TO service_role;
