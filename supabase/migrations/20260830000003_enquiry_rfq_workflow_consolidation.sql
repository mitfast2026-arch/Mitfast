-- Migration: 20260830000003_enquiry_rfq_workflow_consolidation.sql
-- Multi-item Enquiry -> RFQ conversion & Atomic RFQ Editing

-- 1. Multi-item Enquiry -> RFQ atomic conversion
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
  v_enquiry public.enquiries%ROWTYPE;
  v_rfq_id  UUID;
  v_item    JSONB;
  v_updated INTEGER;
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
    INSERT INTO public.rfq_items (
      rfq_id, product_id, product_name_snapshot,
      original_quantity, original_unit_price, final_quantity, final_unit_price
    ) VALUES (
      v_rfq_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      NULL,
      NULL
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

-- 2. Atomic RFQ editing (update lines, add lines, remove lines, update header, recompute totals)
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

    IF v_line_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.rfq_items WHERE id = v_line_id AND rfq_id = p_rfq_id) THEN
      UPDATE public.rfq_items
      SET
        product_id = NULLIF(v_item->>'product_id', '')::UUID,
        product_name_snapshot = COALESCE(v_item->>'product_name_snapshot', product_name_snapshot),
        original_quantity = v_orig_qty,
        original_unit_price = v_orig_price,
        final_quantity = v_final_qty,
        final_unit_price = v_final_price
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
        final_unit_price
      ) VALUES (
        p_rfq_id,
        NULLIF(v_item->>'product_id', '')::UUID,
        COALESCE(v_item->>'product_name_snapshot', 'Product'),
        v_orig_qty,
        v_orig_price,
        v_final_qty,
        v_final_price
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

GRANT EXECUTE ON FUNCTION public.create_rfq_from_enquiry_atomic(UUID, UUID, TEXT, JSONB, TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.edit_rfq_atomic(UUID, JSONB, JSONB, TEXT) TO service_role;
