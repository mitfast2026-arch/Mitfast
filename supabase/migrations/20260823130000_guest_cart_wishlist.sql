-- Guest cart / wishlist + enquiry line items (project qubphaacuuwlpdrsprjl only)

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS guest_sessions_expires_at_idx ON public.guest_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.guest_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_session_id UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guest_session_id, product_id)
);

CREATE INDEX IF NOT EXISTS guest_cart_items_session_idx ON public.guest_cart_items (guest_session_id);

CREATE TABLE IF NOT EXISTS public.guest_wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_session_id UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guest_session_id, product_id)
);

CREATE INDEX IF NOT EXISTS guest_wishlist_items_session_idx ON public.guest_wishlist_items (guest_session_id);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS wishlist_items_customer_idx ON public.wishlist_items (customer_id);

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS line_items JSONB;

COMMENT ON COLUMN public.enquiries.line_items IS 'Cart-sourced enquiry lines: [{product_id, name, quantity}]';

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- Server uses service role; deny direct client access to guest tables
REVOKE ALL ON public.guest_sessions FROM anon, authenticated;
REVOKE ALL ON public.guest_cart_items FROM anon, authenticated;
REVOKE ALL ON public.guest_wishlist_items FROM anon, authenticated;

CREATE POLICY "wishlist_select_own"
  ON public.wishlist_items FOR SELECT
  USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "wishlist_insert_own"
  ON public.wishlist_items FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "wishlist_delete_own"
  ON public.wishlist_items FOR DELETE
  USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
