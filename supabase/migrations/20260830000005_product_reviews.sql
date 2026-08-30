-- Migration 20260830000005_product_reviews.sql
-- Secure product reviews and 5-star ratings with verified RFQ/order eligibility.

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT CHECK (review_text IS NULL OR length(trim(review_text)) <= 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_reviews_customer_product_uniq UNIQUE (customer_id, product_id)
);

CREATE TRIGGER product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_customer_id_idx ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS product_reviews_created_at_idx ON public.product_reviews(created_at DESC);

-- Helper function to check if a customer has a qualifying RFQ or Order for a product
CREATE OR REPLACE FUNCTION public.check_customer_review_eligibility(
  p_customer_id UUID,
  p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_customer_id IS NULL OR p_product_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check if customer has any qualifying RFQ line item for this product
  IF EXISTS (
    SELECT 1
    FROM public.rfqs r
    JOIN public.rfq_items ri ON ri.rfq_id = r.id
    WHERE r.customer_id = p_customer_id
      AND ri.product_id = p_product_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if customer has any qualifying Order line item for this product
  IF EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = p_customer_id
      AND oi.product_id = p_product_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Atomic review upsert RPC (enforces eligibility, validation, and single row per customer-product)
CREATE OR REPLACE FUNCTION public.upsert_product_review(
  p_customer_id UUID,
  p_product_id UUID,
  p_rating INTEGER,
  p_review_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  review_id UUID,
  is_updated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_eligible BOOLEAN;
  v_review_id UUID;
  v_clean_text TEXT;
BEGIN
  IF p_customer_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Customer ID and Product ID are required' USING ERRCODE = 'check_violation';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5' USING ERRCODE = 'check_violation';
  END IF;

  -- Verify eligibility
  v_is_eligible := public.check_customer_review_eligibility(p_customer_id, p_product_id);
  IF NOT v_is_eligible THEN
    RAISE EXCEPTION 'Customer is not eligible to review this product' USING ERRCODE = '42501';
  END IF;

  v_clean_text := NULLIF(trim(p_review_text), '');
  IF v_clean_text IS NOT NULL AND length(v_clean_text) > 2000 THEN
    RAISE EXCEPTION 'Review text exceeds maximum length of 2000 characters' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_review_id
  FROM public.product_reviews
  WHERE customer_id = p_customer_id AND product_id = p_product_id;

  IF FOUND THEN
    UPDATE public.product_reviews
    SET rating = p_rating,
        review_text = v_clean_text,
        updated_at = NOW()
    WHERE id = v_review_id;
    RETURN QUERY SELECT v_review_id, TRUE;
  ELSE
    INSERT INTO public.product_reviews (
      customer_id, product_id, rating, review_text
    ) VALUES (
      p_customer_id, p_product_id, p_rating, v_clean_text
    )
    RETURNING id INTO v_review_id;
    RETURN QUERY SELECT v_review_id, FALSE;
  END IF;
END;
$$;

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Select is public
CREATE POLICY "product_reviews_select_public"
  ON public.product_reviews FOR SELECT
  TO authenticated, anon
  USING (true);

-- Insert requires customer role and eligibility
CREATE POLICY "product_reviews_insert_customer"
  ON public.product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'customer'
    )
    AND public.check_customer_review_eligibility(customer_id, product_id) = true
  );

-- Update requires ownership
CREATE POLICY "product_reviews_update_customer"
  ON public.product_reviews FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Delete requires ownership or admin role
CREATE POLICY "product_reviews_delete_customer_or_admin"
  ON public.product_reviews FOR DELETE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grants
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_review_eligibility(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.upsert_product_review(UUID, UUID, INTEGER, TEXT) TO authenticated;
