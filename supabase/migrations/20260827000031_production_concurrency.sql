-- ============================================================
-- MITFAST Production Concurrency & Correctness
-- Unique conversion constraints, atomic RPCs, cart increments,
-- idempotency, product proposal guards, dashboard metrics RPC
-- ============================================================

-- 1. Conversion uniqueness (strict 1:1)
CREATE UNIQUE INDEX IF NOT EXISTS orders_rfq_id_unique_idx
  ON public.orders (rfq_id)
  WHERE rfq_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_enquiry_id_unique_idx
  ON public.orders (enquiry_id)
  WHERE enquiry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rfqs_enquiry_id_unique_idx
  ON public.rfqs (enquiry_id)
  WHERE enquiry_id IS NOT NULL;

-- 2. One open product approval request per product
ALTER TABLE public.product_approval_requests
  ADD COLUMN IF NOT EXISTS base_product_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS par_one_open_per_product_idx
  ON public.product_approval_requests (product_id)
  WHERE status IN ('pending', 'update_pending');

-- 3. Idempotency keys (Postgres, not Redis)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key        TEXT PRIMARY KEY,
  scope      TEXT NOT NULL,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON public.idempotency_keys (created_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.idempotency_keys FROM anon, authenticated;

-- 4. OTP send log (rate-limit without Redis)
CREATE TABLE IF NOT EXISTS public.otp_send_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_send_log_email_created_idx
  ON public.otp_send_log (email, created_at DESC);

ALTER TABLE public.otp_send_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_send_log FROM anon, authenticated;

-- 5. Atomic cart quantity increment
CREATE OR REPLACE FUNCTION public.increment_cart_item_quantity(
  p_cart_id    UUID,
  p_product_id UUID,
  p_delta      INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  IF p_delta < 1 THEN
    RAISE EXCEPTION 'delta must be at least 1' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO cart_items (cart_id, product_id, quantity)
  VALUES (p_cart_id, p_product_id, p_delta)
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
  RETURNING quantity INTO v_qty;

  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_guest_cart_item_quantity(
  p_guest_session_id UUID,
  p_product_id       UUID,
  p_delta            INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  IF p_delta < 1 THEN
    RAISE EXCEPTION 'delta must be at least 1' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO guest_cart_items (guest_session_id, product_id, quantity)
  VALUES (p_guest_session_id, p_product_id, p_delta)
  ON CONFLICT (guest_session_id, product_id)
  DO UPDATE SET quantity = guest_cart_items.quantity + EXCLUDED.quantity
  RETURNING quantity INTO v_qty;

  RETURN v_qty;
END;
$$;

-- 6. Claim guest session for merge (delete rows atomically, return lines)
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

-- 7. RFQ → Order (atomic)
CREATE OR REPLACE FUNCTION public.convert_rfq_to_order_atomic(
  p_rfq_id         UUID,
  p_order_number   TEXT,
  p_tracking_token TEXT,
  p_subtotal       NUMERIC,
  p_total          NUMERIC,
  p_order_items    JSONB
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
  v_rfq      public.rfqs%ROWTYPE;
  v_order_id UUID;
  v_item     JSONB;
  v_updated  INTEGER;
BEGIN
  SELECT * INTO v_rfq FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_rfq.status <> 'accepted' THEN
    RAISE EXCEPTION 'RFQ must be accepted before converting to order'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.rfq_id = p_rfq_id) THEN
    RAISE EXCEPTION 'RFQ already converted to order'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.orders (
    order_number, customer_id, rfq_id, status, payment_status,
    delivery_address_snapshot, subtotal, total, tracking_token
  ) VALUES (
    p_order_number, v_rfq.customer_id, p_rfq_id, 'accepted', 'payment_required',
    v_rfq.delivery_address_snapshot, p_subtotal, p_total, p_tracking_token
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

  UPDATE public.rfqs
  SET status = 'converted_to_order', updated_at = NOW()
  WHERE id = p_rfq_id AND status = 'accepted';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'RFQ status changed during conversion'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_rfq.enquiry_id IS NOT NULL THEN
    UPDATE public.enquiries
    SET status = 'converted_to_order', updated_at = NOW()
    WHERE id = v_rfq.enquiry_id
      AND status IN ('new', 'contacted', 'converted_to_rfq');
  END IF;

  RETURN QUERY SELECT v_order_id, p_order_number, p_tracking_token;
END;
$$;

-- 8. Enquiry → Order (atomic)
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_order_atomic(
  p_enquiry_id              UUID,
  p_customer_id             UUID,
  p_order_number            TEXT,
  p_tracking_token          TEXT,
  p_delivery_address        JSONB,
  p_subtotal                NUMERIC,
  p_total                   NUMERIC,
  p_product_id              UUID,
  p_supplier_id             UUID,
  p_product_name_snapshot   TEXT,
  p_supplier_name_snapshot  TEXT,
  p_quantity                INTEGER,
  p_unit_price              NUMERIC,
  p_currency_code           TEXT,
  p_gst_rate                NUMERIC,
  p_gst_included            BOOLEAN,
  p_discount                NUMERIC,
  p_line_subtotal           NUMERIC,
  p_gst_amount              NUMERIC,
  p_line_total              NUMERIC
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
  v_enquiry  public.enquiries%ROWTYPE;
  v_order_id UUID;
  v_updated  INTEGER;
BEGIN
  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = p_enquiry_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_enquiry.status NOT IN ('new', 'contacted') THEN
    RAISE EXCEPTION 'Enquiry cannot be converted in status %', v_enquiry.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.enquiry_id = p_enquiry_id) THEN
    RAISE EXCEPTION 'Enquiry already converted to order'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.orders (
    order_number, customer_id, enquiry_id, status, payment_status,
    delivery_address_snapshot, subtotal, total, tracking_token
  ) VALUES (
    p_order_number, p_customer_id, p_enquiry_id, 'accepted', 'payment_required',
    p_delivery_address, p_subtotal, p_total, p_tracking_token
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, supplier_id, product_name_snapshot, supplier_name_snapshot,
    quantity, unit_price, currency_code, gst_rate, gst_included, discount,
    subtotal, gst_amount, total
  ) VALUES (
    v_order_id, p_product_id, p_supplier_id, p_product_name_snapshot, p_supplier_name_snapshot,
    p_quantity, p_unit_price, p_currency_code, p_gst_rate, p_gst_included, p_discount,
    p_line_subtotal, p_gst_amount, p_line_total
  );

  UPDATE public.enquiries
  SET status = 'converted_to_order', updated_at = NOW()
  WHERE id = p_enquiry_id AND status IN ('new', 'contacted');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Enquiry status changed during conversion'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY SELECT v_order_id, p_order_number, p_tracking_token;
END;
$$;

-- 9. Enquiry → RFQ (atomic)
CREATE OR REPLACE FUNCTION public.create_rfq_from_enquiry_atomic(
  p_enquiry_id              UUID,
  p_customer_id             UUID,
  p_rfq_number              TEXT,
  p_delivery_address        JSONB,
  p_customer_message        TEXT,
  p_original_total          NUMERIC,
  p_product_id              UUID,
  p_product_name_snapshot   TEXT,
  p_quantity                INTEGER,
  p_unit_price              NUMERIC
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

  INSERT INTO public.rfqs (
    rfq_number, customer_id, enquiry_id, status,
    delivery_address_snapshot, customer_message, original_total, final_total
  ) VALUES (
    p_rfq_number, p_customer_id, p_enquiry_id, 'submitted',
    p_delivery_address, p_customer_message, p_original_total, NULL
  )
  RETURNING id INTO v_rfq_id;

  INSERT INTO public.rfq_items (
    rfq_id, product_id, product_name_snapshot,
    original_quantity, original_unit_price, final_quantity, final_unit_price
  ) VALUES (
    v_rfq_id, p_product_id, p_product_name_snapshot,
    p_quantity, p_unit_price, NULL, NULL
  );

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

-- 10. Admin dashboard metrics (single round-trip)
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'totalProducts', (SELECT COUNT(*)::bigint FROM products WHERE archive_status = 'active'),
    'totalSuppliers', (SELECT COUNT(*)::bigint FROM suppliers WHERE status <> 'archived'),
    'newEnquiriesCount', (SELECT COUNT(*)::bigint FROM enquiries WHERE status = 'new'),
    'pendingRfqsCount', (SELECT COUNT(*)::bigint FROM rfqs WHERE status IN ('submitted', 'under_review')),
    'activeOrdersCount', (SELECT COUNT(*)::bigint FROM orders WHERE status IN ('accepted', 'packing')),
    'productsAwaitingApprovalCount', (SELECT COUNT(*)::bigint FROM product_approval_requests WHERE status IN ('pending', 'update_pending')),
    'pendingSuppliersCount', (SELECT COUNT(*)::bigint FROM suppliers WHERE status = 'pending')
  );
$$;

-- 11. Fix supplier_product_demand_stats — restore views + TS-compatible column names
DROP FUNCTION IF EXISTS public.supplier_product_demand_stats(uuid);
CREATE OR REPLACE FUNCTION public.supplier_product_demand_stats(p_supplier_id uuid)
RETURNS TABLE (
  product_id   uuid,
  product_name text,
  views        bigint,
  enquiries    bigint,
  rfqs         bigint,
  orders       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(p.view_count, 0)::bigint AS views,
    COALESCE(e.cnt, 0)::bigint AS enquiries,
    COALESCE(r.cnt, 0)::bigint AS rfqs,
    COALESCE(o.cnt, 0)::bigint AS orders
  FROM products p
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM enquiries
    WHERE product_id IN (SELECT id FROM products WHERE supplier_id = p_supplier_id)
    GROUP BY product_id
  ) e ON e.product_id = p.id
  LEFT JOIN (
    SELECT ri.product_id, COUNT(*) AS cnt
    FROM rfq_items ri
    JOIN rfqs rf ON rf.id = ri.rfq_id
    WHERE ri.product_id IN (SELECT id FROM products WHERE supplier_id = p_supplier_id)
    GROUP BY ri.product_id
  ) r ON r.product_id = p.id
  LEFT JOIN (
    SELECT oi.product_id, COUNT(*) AS cnt
    FROM order_items oi
    WHERE oi.product_id IN (SELECT id FROM products WHERE supplier_id = p_supplier_id)
    GROUP BY oi.product_id
  ) o ON o.product_id = p.id
  WHERE p.supplier_id = p_supplier_id
  ORDER BY (COALESCE(e.cnt, 0) + COALESCE(r.cnt, 0) + COALESCE(o.cnt, 0)) DESC;
$$;

-- Grant execute to service role (via postgres default for SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.increment_cart_item_quantity(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_guest_cart_item_quantity(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_guest_session_for_merge(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_rfq_to_order_atomic(UUID, TEXT, TEXT, NUMERIC, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_order_atomic(UUID, UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, UUID, UUID, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_rfq_from_enquiry_atomic(UUID, UUID, TEXT, JSONB, TEXT, NUMERIC, UUID, TEXT, INTEGER, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO service_role;
