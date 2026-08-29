-- Supplier write concurrency: atomic create/update/reorder RPCs,
-- image slot reservation, indexes, and rate-limit log pruning.

-- ---------------------------------------------------------------------------
-- 1. Indexes for supplier portal + approval/image lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS par_product_status_idx
  ON public.product_approval_requests (product_id, status);

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
  ON public.product_images (product_id, sort_order);

CREATE INDEX IF NOT EXISTS products_supplier_portal_idx
  ON public.products (supplier_id, approval_status, archive_status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Atomic supplier product create
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_supplier_product_atomic(
  p_supplier_id UUID,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_status TEXT;
  v_product_id UUID;
  v_suggested_moq INTEGER;
  v_supplier_price NUMERIC;
  v_selling_price NUMERIC;
  v_gst_rate NUMERIC;
  v_gst_included BOOLEAN;
  v_discount NUMERIC;
  v_spec JSONB;
  v_idx INTEGER := 0;
BEGIN
  IF p_supplier_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'supplier_id and payload are required' USING ERRCODE = 'check_violation';
  END IF;

  SELECT status INTO v_supplier_status
  FROM public.suppliers
  WHERE id = p_supplier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_supplier_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active suppliers can create products' USING ERRCODE = 'check_violation';
  END IF;

  v_suggested_moq := COALESCE((p_payload->>'suggested_moq')::INTEGER, 100);
  v_supplier_price := COALESCE((p_payload->>'supplier_price')::NUMERIC, 0);
  v_selling_price := COALESCE((p_payload->>'selling_price')::NUMERIC, v_supplier_price);
  v_gst_rate := COALESCE((p_payload->>'gst_rate')::NUMERIC, 18);
  v_gst_included := COALESCE((p_payload->>'gst_included')::BOOLEAN, false);
  v_discount := COALESCE((p_payload->>'discount')::NUMERIC, 0);

  INSERT INTO public.products (
    supplier_id,
    category_id,
    name,
    description,
    sku,
    stock_quantity,
    moq,
    suggested_moq,
    supplier_price,
    profit_type,
    profit_value,
    selling_price,
    discount,
    gst_rate,
    gst_included,
    min_order_value,
    approval_status,
    publication_status,
    archive_status,
    is_draft
  )
  VALUES (
    p_supplier_id,
    (p_payload->>'category_id')::UUID,
    NULLIF(trim(p_payload->>'name'), ''),
    NULLIF(p_payload->>'description', ''),
    NULLIF(p_payload->>'sku', ''),
    COALESCE((p_payload->>'stock_quantity')::INTEGER, 0),
    v_suggested_moq,
    v_suggested_moq,
    v_supplier_price,
    'percentage',
    15,
    v_selling_price,
    v_discount,
    v_gst_rate,
    v_gst_included,
    CASE
      WHEN p_payload ? 'min_order_value' AND NULLIF(p_payload->>'min_order_value', '') IS NOT NULL
        THEN (p_payload->>'min_order_value')::NUMERIC
      ELSE NULL
    END,
    'pending',
    'unpublished',
    'active',
    false
  )
  RETURNING id INTO v_product_id;

  IF p_payload ? 'specifications' AND jsonb_typeof(p_payload->'specifications') = 'array' THEN
    FOR v_spec IN SELECT * FROM jsonb_array_elements(p_payload->'specifications')
    LOOP
      INSERT INTO public.product_specifications (product_id, spec_name, spec_value, sort_order)
      VALUES (
        v_product_id,
        COALESCE(NULLIF(v_spec->>'spec_name', ''), 'Spec'),
        COALESCE(v_spec->>'spec_value', ''),
        COALESCE((v_spec->>'sort_order')::INTEGER, v_idx)
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  IF p_payload ? 'image_urls' AND jsonb_typeof(p_payload->'image_urls') = 'array' THEN
    v_idx := 0;
    FOR v_spec IN SELECT * FROM jsonb_array_elements(p_payload->'image_urls')
    LOOP
      IF NULLIF(trim(v_spec #>> '{}'), '') IS NOT NULL THEN
        INSERT INTO public.product_images (product_id, image_url, sort_order, is_primary)
        VALUES (
          v_product_id,
          trim(v_spec #>> '{}'),
          v_idx,
          v_idx = 0
        );
        v_idx := v_idx + 1;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.product_approval_requests (
    product_id,
    request_type,
    proposed_data,
    status
  )
  VALUES (
    v_product_id,
    'new_product',
    COALESCE(p_payload->'proposed_data', p_payload),
    'pending'
  );

  RETURN v_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_supplier_product_atomic(UUID, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Atomic supplier update submission
-- ---------------------------------------------------------------------------
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
  v_baseline TIMESTAMPTZ;
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

  v_baseline := COALESCE(p_base_updated_at, v_updated_at);

  UPDATE public.product_approval_requests
  SET
    status = 'rejected',
    rejection_reason = 'Superseded by newer submission',
    reviewed_at = now()
  WHERE product_id = p_product_id
    AND status IN ('pending', 'update_pending');

  UPDATE public.products
  SET updated_at = now()
  WHERE id = p_product_id;

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
      v_baseline
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

-- ---------------------------------------------------------------------------
-- 4. Atomic image reorder
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_product_images_atomic(
  p_product_id UUID,
  p_ordered_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
  v_input_count INTEGER;
  v_matched INTEGER;
BEGIN
  IF p_product_id IS NULL OR p_ordered_ids IS NULL THEN
    RAISE EXCEPTION 'product_id and ordered_ids are required' USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize concurrent reorders for the same product (primary unique index).
  PERFORM pg_advisory_xact_lock(hashtextextended('reorder:' || p_product_id::text, 0));

  SELECT count(*)::INTEGER INTO v_existing_count
  FROM public.product_images
  WHERE product_id = p_product_id;

  v_input_count := coalesce(array_length(p_ordered_ids, 1), 0);

  IF v_input_count <> v_existing_count THEN
    RAISE EXCEPTION 'orderedImageIds must include every image for this product'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*)::INTEGER INTO v_matched
  FROM public.product_images
  WHERE product_id = p_product_id
    AND id = ANY (p_ordered_ids);

  IF v_matched <> v_existing_count THEN
    RAISE EXCEPTION 'One or more image IDs do not belong to this product'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Clear primary first to avoid unique partial index violation while swapping.
  UPDATE public.product_images
  SET is_primary = false
  WHERE product_id = p_product_id
    AND is_primary = true;

  UPDATE public.product_images pi
  SET
    sort_order = ord.ord - 1,
    is_primary = (ord.ord = 1)
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ord)
  WHERE pi.id = ord.id
    AND pi.product_id = p_product_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_product_images_atomic(UUID, UUID[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Reserve image slot under advisory lock (prevents max-count race)
-- Inserts a placeholder row so the slot is held across the S3 upload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_product_image_slot(
  p_product_id UUID,
  p_max INTEGER
)
RETURNS TABLE (image_id UUID, sort_order INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_max INTEGER;
  v_sort INTEGER;
  v_id UUID;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required' USING ERRCODE = 'check_violation';
  END IF;

  v_max := GREATEST(COALESCE(p_max, 8), 1);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  SELECT count(*)::INTEGER INTO v_count
  FROM public.product_images
  WHERE product_id = p_product_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'MAX_IMAGES' USING ERRCODE = 'check_violation';
  END IF;

  v_sort := v_count;

  -- Always insert non-primary; caller sets primary after upload succeeds
  INSERT INTO public.product_images (
    product_id,
    image_url,
    storage_path,
    sort_order,
    is_primary
  )
  VALUES (
    p_product_id,
    'pending://reserve',
    NULL,
    v_sort,
    false
  )
  RETURNING id INTO v_id;

  image_id := v_id;
  sort_order := v_sort;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_product_image_slot(UUID, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Prune old rate-limit log rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_api_rate_limit_log(
  p_older_than INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.api_rate_limit_log
  WHERE created_at < now() - COALESCE(p_older_than, INTERVAL '7 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_api_rate_limit_log(INTERVAL) TO service_role;

-- Optional: schedule via pg_cron if available
-- SELECT cron.schedule('prune-api-rate-limit-log', '0 3 * * *',
--   $$SELECT public.prune_api_rate_limit_log(INTERVAL '7 days')$$);
