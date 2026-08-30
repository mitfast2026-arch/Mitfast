-- Migration: 20260830000001_security_hardening_and_grants.sql
-- Security Hardening: Tighten RLS policies, revoke anon/public execution on privileged RPCs, and protect auth identities

-- 1. Enforce strict customer_id and status constraints on client enquiry inserts
DROP POLICY IF EXISTS "enquiries_insert_public" ON public.enquiries;

CREATE POLICY "enquiries_insert_policy"
  ON public.enquiries FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    -- Unauthenticated users cannot set a customer_id
    (auth.uid() IS NULL AND customer_id IS NULL AND status = 'new'::enquiry_status)
    OR
    -- Authenticated users can only link their own customer profile ID
    (auth.uid() IS NOT NULL AND (
      customer_id IS NULL OR customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    ) AND status = 'new'::enquiry_status)
  );

-- 2. Protect auth rate limit and identity tracking tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_identities') THEN
    EXECUTE 'ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "auth_identities_service_only" ON public.auth_identities';
    EXECUTE 'CREATE POLICY "auth_identities_service_only" ON public.auth_identities FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_rate_limit_buckets') THEN
    EXECUTE 'ALTER TABLE public.auth_rate_limit_buckets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "auth_rate_limit_buckets_service_only" ON public.auth_rate_limit_buckets';
    EXECUTE 'CREATE POLICY "auth_rate_limit_buckets_service_only" ON public.auth_rate_limit_buckets FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 3. Revoke public/anon execution on privileged backend functions
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT routine_name, specific_schema
    FROM information_schema.routines
    WHERE specific_schema = 'public'
      AND routine_name IN (
        'convert_lead_to_order',
        'deduct_order_inventory_on_fulfillment',
        'generate_invoice_serial',
        'get_inventory_parity_counts',
        'get_inventory_stock_metrics',
        'get_supplier_inventory_alert_count',
        'create_manual_order_atomic',
        'edit_order_atomic',
        'admin_dashboard_metrics',
        'approve_product_core_atomic',
        'convert_rfq_to_order_atomic',
        'convert_enquiry_to_order_atomic',
        'create_rfq_from_enquiry_atomic'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM PUBLIC, anon', fn_record.routine_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO service_role', fn_record.routine_name);
  END LOOP;
END $$;

-- 4. Notification helper functions: restrict to authenticated users with user_id matching
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_all_notifications_read') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_all_notifications_read FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_notifications_read') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_notifications_read FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_notifications_read TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_entity_notifications_read') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_entity_notifications_read FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_entity_notifications_read TO authenticated, service_role';
  END IF;
END $$;
