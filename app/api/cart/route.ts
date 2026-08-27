import { NextResponse, type NextRequest } from 'next/server';
import {
  getCustomerCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCustomerCart,
} from '@/lib/server/cart/cart-service';
import {
  getGuestCart,
  addToGuestCart,
  updateGuestCartItemQuantity,
  removeGuestCartItem,
  clearGuestCart,
} from '@/lib/server/guest/guest-cart';
import { ensureGuestSessionId, peekGuestSessionId } from '@/lib/server/guest/session';
import { getServerSession } from '@/lib/server/auth/get-session';
import { assertRateLimit } from '@/lib/server/db/rate-limit';

type CartActor =
  | { kind: 'customer'; customerId: string }
  | { kind: 'guest'; guestSessionId: string }
  | { kind: 'forbidden'; role: string }
  | { kind: 'anonymous' };

async function resolveCartActor(options?: { createGuest?: boolean }): Promise<CartActor> {
  const session = await getServerSession();
  const role = session?.profile.role;
  if (role === 'admin' || role === 'supplier') {
    return { kind: 'forbidden', role };
  }
  if (role === 'customer' && session?.profile?.id) {
    return { kind: 'customer', customerId: session.profile.id };
  }
  if (options?.createGuest === false) {
    const existing = await peekGuestSessionId();
    if (!existing) return { kind: 'anonymous' };
    return { kind: 'guest', guestSessionId: existing };
  }
  const guestSessionId = await ensureGuestSessionId();
  return { kind: 'guest', guestSessionId };
}

function forbiddenCartResponse(role: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Cart is not available for this account type',
        code: 'FORBIDDEN',
        role,
      },
    },
    { status: 403 }
  );
}

async function rateLimitOrResponse(scope: string, key: string) {
  const limited = await assertRateLimit({
    scope,
    key,
    windowSeconds: 60,
    maxHits: 60,
  });
  if (!limited.ok) {
    const status = limited.code === 'DATABASE_MISCONFIGURED' ? 503 : 429;
    return NextResponse.json(
      {
        success: false,
        error: {
          message: limited.code === 'RATE_LIMITED' ? 'Too many requests' : 'Rate limit unavailable',
          code: limited.code,
        },
      },
      { status }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const countOnly = new URL(request.url).searchParams.get('countOnly') === '1';
    const actor = await resolveCartActor({ createGuest: !countOnly });
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);

    if (countOnly) {
      if (actor.kind === 'anonymous') {
        return NextResponse.json({
          success: true,
          data: { itemCount: 0, items: [], isGuest: true },
        });
      }
      if (actor.kind === 'customer') {
        const admin = (await import('@/lib/supabase/admin')).createAdminClient();
        const { data: cart } = await admin
          .from('carts')
          .select('id')
          .eq('customer_id', actor.customerId)
          .maybeSingle();
        let itemCount = 0;
        if (cart?.id) {
          const { count } = await admin
            .from('cart_items')
            .select('id', { count: 'exact', head: true })
            .eq('cart_id', cart.id);
          itemCount = count || 0;
        }
        return NextResponse.json({
          success: true,
          data: { itemCount, items: [], isGuest: false },
        });
      }
      // Cheap count — avoid product_images embed used by getGuestCart.
      const admin = (await import('@/lib/supabase/admin')).createAdminClient();
      const { count } = await admin
        .from('guest_cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('guest_session_id', actor.guestSessionId);
      return NextResponse.json({
        success: true,
        data: {
          itemCount: count || 0,
          items: [],
          isGuest: true,
        },
      });
    }

    if (actor.kind === 'anonymous') {
      return NextResponse.json({
        success: true,
        data: { cartId: 'guest', items: [], itemCount: 0, subtotal: 0, isGuest: true },
      });
    }

    const result =
      actor.kind === 'customer'
        ? await getCustomerCart(actor.customerId)
        : await getGuestCart(actor.guestSessionId);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({
      ...result,
      data: { ...result.data, isGuest: actor.kind === 'guest' },
    });
  } catch (error) {
    console.error('[GET /api/cart]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing productId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const actor = await resolveCartActor({ createGuest: true });
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);
    if (actor.kind === 'anonymous') {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to create guest session', code: 'INTERNAL_ERROR' } },
        { status: 500 }
      );
    }

    const rateKey =
      actor.kind === 'customer' ? `customer:${actor.customerId}` : `guest:${actor.guestSessionId}`;
    const limited = await rateLimitOrResponse('cart_write', rateKey);
    if (limited) return limited;

    const result =
      actor.kind === 'customer'
        ? await addToCart(actor.customerId, productId, quantity || 1)
        : await addToGuestCart(actor.guestSessionId, productId, quantity || 1);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[POST /api/cart]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { cartItemId, quantity } = body;

    if (!cartItemId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing cartItemId or quantity', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const actor = await resolveCartActor({ createGuest: true });
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);
    if (actor.kind === 'anonymous') {
      return NextResponse.json(
        { success: false, error: { message: 'No cart session', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const result =
      actor.kind === 'customer'
        ? await updateCartItemQuantity(actor.customerId, cartItemId, quantity)
        : await updateGuestCartItemQuantity(actor.guestSessionId, cartItemId, quantity);

    if (!result.success) {
      const status = result.error?.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[PUT /api/cart]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartItemId = searchParams.get('cartItemId');
    const clearAll = searchParams.get('clear');
    const actor = await resolveCartActor({ createGuest: false });
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);
    if (actor.kind === 'anonymous') {
      return NextResponse.json({ success: true, data: { cleared: true } });
    }

    if (cartItemId) {
      const result =
        actor.kind === 'customer'
          ? await removeCartItem(actor.customerId, cartItemId)
          : await removeGuestCartItem(actor.guestSessionId, cartItemId);

      if (!result.success) {
        const status = result.error?.code === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (clearAll === '1' || clearAll === 'true') {
      if (actor.kind === 'customer') await clearCustomerCart(actor.customerId);
      else await clearGuestCart(actor.guestSessionId);
      return NextResponse.json({ success: true, data: { cleared: true } });
    }

    return NextResponse.json(
      { success: false, error: { message: 'cartItemId or clear is required', code: 'VALIDATION_ERROR' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DELETE /api/cart]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
