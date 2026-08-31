-- Migration 20260830000007_lock_product_reviews_rpc.sql
-- Restrict review RPCs execution to service_role only.
-- The Next.js backend uses createAdminClient() (service_role) which validates customer eligibility before calling.
-- Direct execution via PostgREST by anon or authenticated users is revoked to prevent impersonation.

REVOKE ALL ON FUNCTION public.upsert_product_review(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_product_review(UUID, UUID, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.check_customer_review_eligibility(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_review_eligibility(UUID, UUID) TO service_role;
