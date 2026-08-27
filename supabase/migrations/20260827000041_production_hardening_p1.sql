-- Production hardening: revoke stats RPC public execute, multi-RFQ submit,
-- MOQ-aware cart increments, rate limits, negotiate/approve atomics, view throttle.

-- ---------------------------------------------------------------------------
-- 1. Lock down SECURITY DEFINER stats RPCs (service_role only)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.supplier_product_demand_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_product_demand_stats(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.supplier_admin_summary_stats(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_admin_summary_stats(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Generic rate-limit table + advisory-locked recorder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limit_log (
  id         BIGSERIAL PRIMARY KEY,
  scope      TEXT NOT NULL,
  rate_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_rate_limit_log_scope_key_created_idx
  ON public.api_rate_limit_log (scope, rate_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.try_record_rate_limit(
  p_scope TEXT,
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max_hits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_scope IS NULL OR length(trim(p_scope)) = 0 OR p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key, 0));

  SELECT count(*)::INTEGER INTO v_count
  FROM public.api_rate_limit_log
  WHERE scope = p_scope
    AND rate_key = p_key
    AND created_at > now() - make_interval(secs => GREATEST(p_window_seconds, 1));

  IF v_count >= p_max_hits THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.api_rate_limit_log (scope, rate_key) VALUES (p_scope, p_key);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_record_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. MOQ-aware cart quantity increments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_cart_item_quantity(
  p_cart_id UUID,
  p_product_id UUID,
  p_delta INTEGER,
  p_moq INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  IF p_delta IS NULL OR p_delta < 1 THEN
    RAISE EXCEPTION 'Quantity delta must be at least 1' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.cart_items (cart_id, product_id, quantity)
  VALUES (p_cart_id, p_product_id, p_delta)
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET quantity = public.cart_items.quantity + EXCLUDED.quantity
  RETURNING quantity INTO v_qty;

  IF v_qty < GREATEST(COALESCE(p_moq, 1), 1) THEN
    RAISE EXCEPTION 'Below MOQ' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_guest_cart_item_quantity(
  p_guest_session_id UUID,
  p_product_id UUID,
  p_delta INTEGER,
  p_moq INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  IF p_delta IS NULL OR p_delta < 1 THEN
    RAISE EXCEPTION 'Quantity delta must be at least 1' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.guest_cart_items (guest_session_id, product_id, quantity)
  VALUES (p_guest_session_id, p_product_id, p_delta)
  ON CONFLICT (guest_session_id, product_id)
  DO UPDATE SET quantity = public.guest_cart_items.quantity + EXCLUDED.quantity
  RETURNING quantity INTO v_qty;

  IF v_qty < GREATEST(COALESCE(p_moq, 1), 1) THEN
    RAISE EXCEPTION 'Below MOQ' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_qty;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_cart_item_quantity(UUID, UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_guest_cart_item_quantity(UUID, UUID, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Submit multiple RFQs from cart (one per supplier group) atomically
-- p_groups: [{ "rfq_number", "original_total", "items": [same shape as before] }]
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
  v_cart_id UUID;
  v_group   JSONB;
  v_item    JSONB;
  v_rfq_id  UUID;
  v_rfq_no  TEXT;
  v_sup_key TEXT;
  v_total   NUMERIC;
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

    rfq_id := v_rfq_id;
    rfq_number := v_rfq_no;
    supplier_key := v_sup_key;
    RETURN NEXT;
  END LOOP;

  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_rfqs_from_cart_atomic(UUID, JSONB, TEXT, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Negotiate RFQ items atomically; recompute final_total from ALL lines
-- p_items: [{ "rfq_item_id", "final_quantity", "final_unit_price" }]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.negotiate_rfq_items_atomic(
  p_rfq_id UUID,
  p_items JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_item   JSONB;
  v_total  NUMERIC := 0;
  v_row    RECORD;
BEGIN
  SELECT status INTO v_status FROM public.rfqs WHERE id = p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'RFQ cannot be negotiated in its current state' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    UPDATE public.rfq_items
    SET
      final_quantity = (v_item->>'final_quantity')::INTEGER,
      final_unit_price = (v_item->>'final_unit_price')::NUMERIC
    WHERE id = (v_item->>'rfq_item_id')::UUID
      AND rfq_id = p_rfq_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'RFQ item not found on this RFQ' USING ERRCODE = 'P0002';
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT
      COALESCE(final_quantity, original_quantity) AS qty,
      COALESCE(final_unit_price, original_unit_price) AS unit_price
    FROM public.rfq_items
    WHERE rfq_id = p_rfq_id
  LOOP
    v_total := v_total + ROUND((v_row.qty * v_row.unit_price)::NUMERIC, 2);
  END LOOP;

  UPDATE public.rfqs
  SET
    final_total = ROUND(v_total, 2),
    status = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END,
    updated_at = now()
  WHERE id = p_rfq_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.negotiate_rfq_items_atomic(UUID, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Sampled product view increment (at most once per key per window)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_product_view_sampled(
  p_id UUID,
  p_sample_key TEXT DEFAULT 'anon',
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.try_record_rate_limit(
    'product_view',
    p_id::TEXT || ':' || COALESCE(p_sample_key, 'anon'),
    GREATEST(p_window_seconds, 10),
    1
  ) THEN
    RETURN;
  END IF;

  UPDATE public.products
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_product_view_sampled(UUID, TEXT, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Approve product request + core product fields atomically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_product_core_atomic(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_product_update JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_status TEXT;
  v_baseline TIMESTAMPTZ;
  v_updated_at TIMESTAMPTZ;
BEGIN
  SELECT product_id, status, base_product_updated_at
  INTO v_product_id, v_status, v_baseline
  FROM public.product_approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status NOT IN ('pending', 'update_pending') THEN
    RAISE EXCEPTION 'Approval request is no longer open' USING ERRCODE = 'check_violation';
  END IF;

  SELECT updated_at INTO v_updated_at
  FROM public.products
  WHERE id = v_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target product not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_baseline IS NOT NULL AND v_updated_at IS DISTINCT FROM v_baseline THEN
    RAISE EXCEPTION 'STALE_PROPOSAL' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.product_approval_requests
  SET
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = p_admin_user_id
  WHERE id = p_request_id;

  UPDATE public.products
  SET
    approval_status = 'approved',
    rejection_reason = NULL,
    supplier_price = COALESCE((p_product_update->>'supplier_price')::NUMERIC, supplier_price),
    selling_price = COALESCE((p_product_update->>'selling_price')::NUMERIC, selling_price),
    name = COALESCE(NULLIF(p_product_update->>'name', ''), name),
    category_id = CASE
      WHEN p_product_update ? 'category_id' AND NULLIF(p_product_update->>'category_id', '') IS NOT NULL
        THEN (p_product_update->>'category_id')::UUID
      ELSE category_id
    END,
    description = CASE
      WHEN p_product_update ? 'description' THEN p_product_update->>'description'
      ELSE description
    END,
    sku = CASE
      WHEN p_product_update ? 'sku' THEN p_product_update->>'sku'
      ELSE sku
    END,
    suggested_moq = CASE
      WHEN p_product_update ? 'suggested_moq' THEN (p_product_update->>'suggested_moq')::INTEGER
      ELSE suggested_moq
    END,
    updated_at = now()
  WHERE id = v_product_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_product_core_atomic(UUID, UUID, JSONB) TO service_role;

-- Hot RLS initplan: profiles select-own (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    EXECUTE $pol$
      DROP POLICY "profiles_select_own" ON public.profiles;
      CREATE POLICY "profiles_select_own"
        ON public.profiles FOR SELECT
        USING (id = (SELECT auth.uid()));
    $pol$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = 'suppliers_select_own'
  ) THEN
    EXECUTE $pol$
      DROP POLICY "suppliers_select_own" ON public.suppliers;
      CREATE POLICY "suppliers_select_own"
        ON public.suppliers FOR SELECT
        USING (user_id = (SELECT auth.uid()));
    $pol$;
  END IF;
END $$;
