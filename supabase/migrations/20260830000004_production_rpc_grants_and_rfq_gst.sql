-- Production hardening:
-- 1. Revoke PUBLIC/anon/authenticated EXECUTE on privileged SECURITY DEFINER RPCs
-- 2. RLS + REVOKE on api_rate_limit_log
-- 3. Drop leftover 10-arg create_rfq_from_enquiry_atomic and 3-arg cart increment overloads
-- 4. SET search_path on increment_product_view
-- 5. Snapshot GST onto rfq_items; populate on cart submit / enquiry→RFQ / RFQ edit inserts
--
-- Trigger functions are left executable (auth.users / row triggers).
-- Application RPCs are service_role-only. Next.js calls them via createAdminClient().

-- ---------------------------------------------------------------------------
-- GST snapshot columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.rfq_items
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_included BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rfq_items.gst_rate IS
  'GST rate snapshotted at RFQ submit/convert-from-enquiry. Convert-to-order must use this, not live products.gst_rate.';
COMMENT ON COLUMN public.rfq_items.gst_included IS
  'Whether snapshotted unit prices already include GST. Convert-to-order must use this, not live products.gst_included.';

UPDATE public.rfq_items ri
SET
  gst_rate = COALESCE(p.gst_rate, 0),
  gst_included = COALESCE(p.gst_included, false)
FROM public.products p
WHERE ri.product_id = p.id;

-- ---------------------------------------------------------------------------
-- Drop leftover overloads (idempotent)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_rfq_from_enquiry_atomic(UUID, UUID, TEXT, JSONB, TEXT, NUMERIC, UUID, TEXT, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.increment_cart_item_quantity(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.increment_guest_cart_item_quantity(UUID, UUID, INTEGER);

-- ---------------------------------------------------------------------------
-- increment_product_view: pin search_path
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.increment_product_view(uuid) SET search_path = public;

-- ---------------------------------------------------------------------------
-- RFQ insert paths: persist GST snapshot (payload, else product row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_rfqs_from_cart_atomic(
  p_customer_id      UUID,
  p_delivery_address JSONB,
  p_customer_message TEXT,
  p_groups           JSONB
)
RETURNS TABLE (
  rfq_id       UUID,
  rfq_number   TEXT,
  supplier_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id      UUID;
  v_group        JSONB;
  v_item         JSONB;
  v_rfq_id       UUID;
  v_rfq_no       TEXT;
  v_sup_key      TEXT;
  v_total        NUMERIC;
  v_gst_rate     NUMERIC;
  v_gst_included BOOLEAN;
BEGIN
  IF p_groups IS NULL OR jsonb_typeof(p_groups) <> 'array' OR jsonb_array_length(p_groups) = 0 THEN
    RAISE EXCEPTION 'RFQ groups empty' USING ERRCODE = 'check_violation';
  END IF;

  SELECT c.id INTO v_cart_id
  FROM public.carts c
  WHERE c.customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.cart_items WHERE cart_id = v_cart_id FOR UPDATE;

  FOR v_group IN SELECT value FROM jsonb_array_elements(p_groups)
  LOOP
    v_rfq_no := v_group->>'rfq_number';
    v_sup_key := COALESCE(v_group->>'supplier_key', 'platform');
    v_total := (v_group->>'original_total')::NUMERIC;

    IF v_group->'items' IS NULL OR jsonb_array_length(v_group->'items') = 0 THEN
      RAISE EXCEPTION 'RFQ group has no items' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.rfqs (
      rfq_number, customer_id, status,
      delivery_address_snapshot, customer_message, original_total, final_total
    ) VALUES (
      v_rfq_no, p_customer_id, 'submitted',
      p_delivery_address, p_customer_message, v_total, NULL
    )
    RETURNING id INTO v_rfq_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_group->'items')
    LOOP
      v_gst_rate := COALESCE((v_item->>'gst_rate')::NUMERIC, 0);
      v_gst_included := COALESCE((v_item->>'gst_included')::BOOLEAN, false);
      SELECT
        COALESCE((v_item->>'gst_rate')::NUMERIC, p.gst_rate, 0),
        COALESCE((v_item->>'gst_included')::BOOLEAN, p.gst_included, false)
      INTO v_gst_rate, v_gst_included
      FROM public.products p
      WHERE p.id = (v_item->>'product_id')::UUID;

      INSERT INTO public.rfq_items (
        rfq_id, product_id, product_name_snapshot,
        original_quantity, original_unit_price, final_quantity, final_unit_price,
        gst_rate, gst_included
      ) VALUES (
        v_rfq_id,
        (v_item->>'product_id')::UUID,
        v_item->>'product_name_snapshot',
        (v_item->>'original_quantity')::INTEGER,
        (v_item->>'original_unit_price')::NUMERIC,
        NULL,
        NULL,
        COALESCE(v_gst_rate, 0),
        COALESCE(v_gst_included, false)
      );
    END LOOP;

    rfq_id := v_rfq_id;
    rfq_number := v_rfq_no;
    supplier_key := v_sup_key;
    RETURN NEXT;
  END LOOP;

  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_rfq_from_cart_atomic(
  p_customer_id      UUID,
  p_rfq_number       TEXT,
  p_delivery_address JSONB,
  p_customer_message TEXT,
  p_original_total   NUMERIC,
  p_items            JSONB
)
RETURNS TABLE (
  rfq_id     UUID,
  rfq_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id      UUID;
  v_rfq_id       UUID;
  v_item         JSONB;
  v_gst_rate     NUMERIC;
  v_gst_included BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'RFQ cart is empty' USING ERRCODE = 'check_violation';
  END IF;

  SELECT c.id INTO v_cart_id
  FROM public.carts c
  WHERE c.customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.cart_items WHERE cart_id = v_cart_id FOR UPDATE;

  INSERT INTO public.rfqs (
    rfq_number, customer_id, status,
    delivery_address_snapshot, customer_message, original_total, final_total
  ) VALUES (
    p_rfq_number, p_customer_id, 'submitted',
    p_delivery_address, p_customer_message, p_original_total, NULL
  )
  RETURNING id INTO v_rfq_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_gst_rate := COALESCE((v_item->>'gst_rate')::NUMERIC, 0);
    v_gst_included := COALESCE((v_item->>'gst_included')::BOOLEAN, false);
    SELECT
      COALESCE((v_item->>'gst_rate')::NUMERIC, p.gst_rate, 0),
      COALESCE((v_item->>'gst_included')::BOOLEAN, p.gst_included, false)
    INTO v_gst_rate, v_gst_included
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::UUID;

    INSERT INTO public.rfq_items (
      rfq_id, product_id, product_name_snapshot,
      original_quantity, original_unit_price, final_quantity, final_unit_price,
      gst_rate, gst_included
    ) VALUES (
      v_rfq_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'original_quantity')::INTEGER,
      (v_item->>'original_unit_price')::NUMERIC,
      NULL,
      NULL,
      COALESCE(v_gst_rate, 0),
      COALESCE(v_gst_included, false)
    );
  END LOOP;

  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;

  RETURN QUERY SELECT v_rfq_id, p_rfq_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_rfq_from_enquiry_atomic(
  p_enquiry_id              UUID,
  p_customer_id             UUID,
  p_rfq_number              TEXT,
  p_delivery_address        JSONB,
  p_customer_message        TEXT,
  p_original_total          NUMERIC,
  p_items                   JSONB
)
RETURNS TABLE (
  rfq_id     UUID,
  rfq_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry      public.enquiries%ROWTYPE;
  v_rfq_id       UUID;
  v_item         JSONB;
  v_updated      INTEGER;
  v_gst_rate     NUMERIC;
  v_gst_included BOOLEAN;
BEGIN
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_enquiry.status IN ('converted_to_rfq', 'converted_to_order', 'closed') THEN
    RAISE EXCEPTION 'Enquiry already converted or closed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.rfqs r WHERE r.enquiry_id = p_enquiry_id) THEN
    RAISE EXCEPTION 'Enquiry already converted to RFQ'
      USING ERRCODE = '23505';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'RFQ must contain at least one item' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.rfqs (
    rfq_number, customer_id, enquiry_id, status,
    delivery_address_snapshot, customer_message, original_total, final_total
  ) VALUES (
    p_rfq_number, p_customer_id, p_enquiry_id, 'submitted',
    p_delivery_address, p_customer_message, p_original_total, NULL
  )
  RETURNING id INTO v_rfq_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_gst_rate := COALESCE((v_item->>'gst_rate')::NUMERIC, 0);
    v_gst_included := COALESCE((v_item->>'gst_included')::BOOLEAN, false);
    SELECT
      COALESCE((v_item->>'gst_rate')::NUMERIC, p.gst_rate, 0),
      COALESCE((v_item->>'gst_included')::BOOLEAN, p.gst_included, false)
    INTO v_gst_rate, v_gst_included
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::UUID;

    INSERT INTO public.rfq_items (
      rfq_id, product_id, product_name_snapshot,
      original_quantity, original_unit_price, final_quantity, final_unit_price,
      gst_rate, gst_included
    ) VALUES (
      v_rfq_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      NULL,
      NULL,
      COALESCE(v_gst_rate, 0),
      COALESCE(v_gst_included, false)
    );
  END LOOP;

  UPDATE public.enquiries
  SET status = 'converted_to_rfq', updated_at = NOW()
  WHERE id = p_enquiry_id AND status IN ('new', 'contacted');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Enquiry status changed during RFQ creation'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY SELECT v_rfq_id, p_rfq_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_rfq_atomic(
  p_rfq_id                  UUID,
  p_items                   JSONB,
  p_delivery_address        JSONB DEFAULT NULL,
  p_customer_message        TEXT DEFAULT NULL
)
RETURNS TABLE (
  rfq_id         UUID,
  original_total NUMERIC,
  final_total    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfq            public.rfqs%ROWTYPE;
  v_item           JSONB;
  v_line_id        UUID;
  v_orig_qty       INTEGER;
  v_orig_price     NUMERIC;
  v_final_qty      INTEGER;
  v_final_price    NUMERIC;
  v_orig_subtotal  NUMERIC := 0;
  v_final_subtotal NUMERIC := 0;
  v_has_final      BOOLEAN := FALSE;
  v_seen_item_ids  UUID[] := ARRAY[]::UUID[];
  v_gst_rate       NUMERIC;
  v_gst_included   BOOLEAN;
BEGIN
  SELECT * INTO v_rfq FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_rfq.status IN ('converted_to_order', 'rejected') THEN
    RAISE EXCEPTION 'Converted or rejected RFQ cannot be edited'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'RFQ must contain at least one product line' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.rfq_items WHERE rfq_id = p_rfq_id ORDER BY id FOR UPDATE;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_line_id := NULLIF(v_item->>'id', '')::UUID;
    v_orig_qty := (v_item->>'original_quantity')::INTEGER;
    v_orig_price := (v_item->>'original_unit_price')::NUMERIC;
    v_final_qty := NULLIF(v_item->>'final_quantity', '')::INTEGER;
    v_final_price := NULLIF(v_item->>'final_unit_price', '')::NUMERIC;

    IF v_orig_qty IS NULL OR v_orig_qty < 1 THEN
      RAISE EXCEPTION 'Original quantity must be at least 1' USING ERRCODE = 'check_violation';
    END IF;

    v_gst_rate := COALESCE((v_item->>'gst_rate')::NUMERIC, 0);
    v_gst_included := COALESCE((v_item->>'gst_included')::BOOLEAN, false);
    SELECT
      COALESCE((v_item->>'gst_rate')::NUMERIC, p.gst_rate, 0),
      COALESCE((v_item->>'gst_included')::BOOLEAN, p.gst_included, false)
    INTO v_gst_rate, v_gst_included
    FROM public.products p
    WHERE p.id = NULLIF(v_item->>'product_id', '')::UUID;

    IF v_line_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.rfq_items WHERE id = v_line_id AND rfq_id = p_rfq_id) THEN
      UPDATE public.rfq_items
      SET
        product_id = NULLIF(v_item->>'product_id', '')::UUID,
        product_name_snapshot = COALESCE(v_item->>'product_name_snapshot', product_name_snapshot),
        original_quantity = v_orig_qty,
        original_unit_price = v_orig_price,
        final_quantity = v_final_qty,
        final_unit_price = v_final_price,
        gst_rate = COALESCE(v_gst_rate, gst_rate),
        gst_included = COALESCE(v_gst_included, gst_included)
      WHERE id = v_line_id AND rfq_id = p_rfq_id;

      v_seen_item_ids := array_append(v_seen_item_ids, v_line_id);
    ELSE
      INSERT INTO public.rfq_items (
        rfq_id,
        product_id,
        product_name_snapshot,
        original_quantity,
        original_unit_price,
        final_quantity,
        final_unit_price,
        gst_rate,
        gst_included
      ) VALUES (
        p_rfq_id,
        NULLIF(v_item->>'product_id', '')::UUID,
        COALESCE(v_item->>'product_name_snapshot', 'Product'),
        v_orig_qty,
        v_orig_price,
        v_final_qty,
        v_final_price,
        COALESCE(v_gst_rate, 0),
        COALESCE(v_gst_included, false)
      )
      RETURNING id INTO v_line_id;

      v_seen_item_ids := array_append(v_seen_item_ids, v_line_id);
    END IF;

    v_orig_subtotal := v_orig_subtotal + (v_orig_qty * v_orig_price);
    IF v_final_price IS NOT NULL THEN
      v_has_final := TRUE;
      v_final_subtotal := v_final_subtotal + (COALESCE(v_final_qty, v_orig_qty) * v_final_price);
    ELSE
      v_final_subtotal := v_final_subtotal + (COALESCE(v_final_qty, v_orig_qty) * v_orig_price);
    END IF;
  END LOOP;

  DELETE FROM public.rfq_items
  WHERE rfq_id = p_rfq_id
    AND NOT (id = ANY(v_seen_item_ids));

  IF (SELECT COUNT(*) FROM public.rfq_items WHERE rfq_id = p_rfq_id) = 0 THEN
    RAISE EXCEPTION 'RFQ must contain at least one product line' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.rfqs
  SET
    original_total = round(v_orig_subtotal, 2),
    final_total = CASE WHEN v_has_final OR v_rfq.final_total IS NOT NULL THEN round(v_final_subtotal, 2) ELSE v_rfq.final_total END,
    delivery_address_snapshot = COALESCE(p_delivery_address, delivery_address_snapshot),
    customer_message = COALESCE(p_customer_message, customer_message),
    updated_at = NOW()
  WHERE id = p_rfq_id;

  RETURN QUERY
  SELECT p_rfq_id, round(v_orig_subtotal, 2), CASE WHEN v_has_final OR v_rfq.final_total IS NOT NULL THEN round(v_final_subtotal, 2) ELSE v_rfq.final_total END;
END;
$$;

-- ---------------------------------------------------------------------------
-- api_rate_limit_log: service-role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.api_rate_limit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limit_log TO service_role;

-- ---------------------------------------------------------------------------
-- Revoke PUBLIC execute on SECURITY DEFINER RPCs (not trigger functions)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  trigger_fns TEXT[] := ARRAY[
    'set_updated_at',
    'handle_new_user',
    'profiles_freeze_role',
    'products_soft_lock_client_insert',
    'products_block_privileged_client_update',
    'suppliers_freeze_status',
    'par_freeze_client_insert_status'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proname = ANY (trigger_fns))
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      r.proname,
      r.args
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;
REVOKE ALL ON FUNCTION public.generate_rfq_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rfq_number() TO service_role;

GRANT EXECUTE ON FUNCTION public.submit_rfqs_from_cart_atomic(UUID, JSONB, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_rfq_from_cart_atomic(UUID, TEXT, JSONB, TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_rfq_from_enquiry_atomic(UUID, UUID, TEXT, JSONB, TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.edit_rfq_atomic(UUID, JSONB, JSONB, TEXT) TO service_role;
