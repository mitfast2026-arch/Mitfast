-- ============================================================
-- Fix try_record_otp_send: serialize per-email with advisory lock
-- so concurrent sends cannot exceed the window max.
-- ============================================================

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

  -- Serialize concurrent rate-limit checks for the same email
  PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));

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

GRANT EXECUTE ON FUNCTION public.try_record_otp_send(TEXT, INTEGER, INTEGER) TO service_role;
