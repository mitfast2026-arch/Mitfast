-- ============================================================
-- MITFAST P0 Correctness
-- Idempotency claim, RFQ-from-cart / manual-order / edit-order
-- atomics, guest-merge lock, OTP rate-limit atomic, enquiry
-- create_enquiry scope support via app layer
-- ============================================================

-- 1. Idempotency: allow in-progress claim (insert-first)
ALTER TABLE public.idempotency_keys
  ALTER COLUMN response DROP NOT NULL;

ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

UPDATE public.idempotency_keys
SET status = 'completed'
WHERE response IS NOT NULL AND status IS DISTINCT FROM 'completed';

ALTER TABLE public.idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_status_check;

ALTER TABLE public.idempotency_keys
  ADD CONSTRAINT idempotency_keys_status_check
  CHECK (status IN ('in_progress', 'completed'));

-- 2. Claim guest session with row locks (prevent double-merge)
CREATE OR REPLACE FUNCTION public.claim_guest_session_for_merge(p_guest_session_id UUID)
RETURNS TABLE (
  cart_product_id UUID,
  cart_quantity   INTEGER,
  wishlist_product_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize concurrent merges on the same guest session
  PERFORM 1 FROM public.guest_sessions
  WHERE id = p_guest_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Lock child rows before reading so a second claim sees empty sets
  PERFORM 1 FROM public.guest_cart_items
  WHERE guest_session_id = p_guest_session_id
  FOR UPDATE;

  PERFORM 1 FROM public.guest_wishlist_items
  WHERE guest_session_id = p_guest_session_id
  FOR UPDATE;

  RETURN QUERY
  SELECT
    gc.product_id,
    gc.quantity,
    NULL::UUID
  FROM guest_cart_items gc
  WHERE gc.guest_session_id = p_guest_session_id;

  RETURN QUERY
  SELECT
    NULL::UUID,
    NULL::INTEGER,
    gw.product_id
  FROM guest_wishlist_items gw
  WHERE gw.guest_session_id = p_guest_session_id;

  DELETE FROM guest_cart_items WHERE guest_session_id = p_guest_session_id;
  DELETE FROM guest_wishlist_items WHERE guest_session_id = p_guest_session_id;

  UPDATE guest_sessions
  SET expires_at = NOW() - INTERVAL '1 second'
  WHERE id = p_guest_session_id;
END;
$$;

-- 3. Atomic OTP send attempt (insert only if under limit)
CREATE OR REPLACE FUNCTION public.try_record_otp_send(
  p_email TEXT,
  p_window_seconds INTEGER DEFAULT 900,
  p_max_sends INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.otp_send_log
  WHERE email = v_email
    AND created_at >= NOW() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_sends THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.otp_send_log (email) VALUES (v_email);
  RETURN TRUE;
END;
$$;

-- 4. Submit RFQ from cart (atomic header + items + clear cart)
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
  v_cart_id UUID;
  v_rfq_id  UUID;
  v_item    JSONB;
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

  -- Lock cart lines so concurrent qty edits cannot race clear
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
    INSERT INTO public.rfq_items (
      rfq_id, product_id, product_name_snapshot,
      original_quantity, original_unit_price, final_quantity, final_unit_price
    ) VALUES (
      v_rfq_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'original_quantity')::INTEGER,
      (v_item->>'original_unit_price')::NUMERIC,
      NULL,
      NULL
    );
  END LOOP;

  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;

  RETURN QUERY SELECT v_rfq_id, p_rfq_number;
END;
$$;

-- 5. Create manual order (atomic header + items)
CREATE OR REPLACE FUNCTION public.create_manual_order_atomic(
  p_customer_id      UUID,
  p_order_number     TEXT,
  p_tracking_token   TEXT,
  p_delivery_address JSONB,
  p_subtotal         NUMERIC,
  p_total            NUMERIC,
  p_order_items      JSONB
)
RETURNS TABLE (
  order_id       UUID,
  order_number   TEXT,
  tracking_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_item     JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_order_items IS NULL OR jsonb_typeof(p_order_items) <> 'array' OR jsonb_array_length(p_order_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.orders (
    order_number, customer_id, status, payment_status,
    delivery_address_snapshot, subtotal, total, tracking_token
  ) VALUES (
    p_order_number, p_customer_id, 'accepted', 'payment_required',
    p_delivery_address, p_subtotal, p_total, p_tracking_token
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, supplier_id, product_name_snapshot, supplier_name_snapshot,
      quantity, unit_price, currency_code, gst_rate, gst_included, discount,
      subtotal, gst_amount, total
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      NULLIF(v_item->>'supplier_id', '')::UUID,
      v_item->>'product_name_snapshot',
      v_item->>'supplier_name_snapshot',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE(v_item->>'currency_code', 'INR'),
      COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
      COALESCE((v_item->>'gst_included')::BOOLEAN, false),
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      (v_item->>'subtotal')::NUMERIC,
      COALESCE((v_item->>'gst_amount')::NUMERIC, 0),
      (v_item->>'total')::NUMERIC
    );
  END LOOP;

  RETURN QUERY SELECT v_order_id, p_order_number, p_tracking_token;
END;
$$;

-- 6. Edit order lines atomically (lock order, update lines, rewrite totals)
CREATE OR REPLACE FUNCTION public.edit_order_atomic(
  p_order_id         UUID,
  p_items            JSONB,
  p_delivery_address JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders%ROWTYPE;
  v_item    JSONB;
  v_subtotal NUMERIC := 0;
  v_total    NUMERIC := 0;
  v_line_id  UUID;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status IN ('cancelled', 'dispatched') THEN
    RAISE EXCEPTION 'Dispatched or cancelled orders cannot be edited'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock all order lines in id order to reduce deadlock risk
  PERFORM 1 FROM public.order_items WHERE order_id = p_order_id ORDER BY id FOR UPDATE;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items) ORDER BY (value->>'order_item_id')
  LOOP
    v_line_id := (v_item->>'order_item_id')::UUID;

    UPDATE public.order_items
    SET
      quantity = (v_item->>'quantity')::INTEGER,
      unit_price = (v_item->>'unit_price')::NUMERIC,
      gst_rate = (v_item->>'gst_rate')::NUMERIC,
      gst_included = (v_item->>'gst_included')::BOOLEAN,
      discount = (v_item->>'discount')::NUMERIC,
      subtotal = (v_item->>'subtotal')::NUMERIC,
      gst_amount = (v_item->>'gst_amount')::NUMERIC,
      total = (v_item->>'total')::NUMERIC
    WHERE id = v_line_id AND order_id = p_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order item % not found on order', v_line_id
        USING ERRCODE = 'P0002';
    END IF;

    v_subtotal := v_subtotal + (v_item->>'subtotal')::NUMERIC;
    v_total := v_total + (v_item->>'total')::NUMERIC;
  END LOOP;

  UPDATE public.orders
  SET
    subtotal = round(v_subtotal, 2),
    total = round(v_total, 2),
    delivery_address_snapshot = COALESCE(p_delivery_address, delivery_address_snapshot),
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_record_otp_send(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_rfq_from_cart_atomic(UUID, TEXT, JSONB, TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_order_atomic(UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.edit_order_atomic(UUID, JSONB, JSONB) TO service_role;
