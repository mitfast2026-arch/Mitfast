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
import { ensureGuestSessionId } from '@/lib/server/guest/session';
import { getServerSession } from '@/lib/server/auth/get-session';

type CartActor =
  | { kind: 'customer'; customerId: string }
  | { kind: 'guest'; guestSessionId: string }
  | { kind: 'forbidden'; role: string };

async function resolveCartActor(): Promise<CartActor> {
  const session = await getServerSession();
  const role = session?.profile.role;
  if (role === 'admin' || role === 'supplier') {
    return { kind: 'forbidden', role };
  }
  if (role === 'customer' && session?.profile?.id) {
    return { kind: 'customer', customerId: session.profile.id };
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

export async function GET(request: NextRequest) {
  try {
    const countOnly = new URL(request.url).searchParams.get('countOnly') === '1';
    const actor = await resolveCartActor();
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);

    if (countOnly) {
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
      const guest = await getGuestCart(actor.guestSessionId);
      if (!guest.success) return NextResponse.json(guest, { status: 400 });
      return NextResponse.json({
        success: true,
        data: {
          itemCount: guest.data.itemCount,
          items: [],
          isGuest: true,
        },
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

    const actor = await resolveCartActor();
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);
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

    const actor = await resolveCartActor();
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);
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
    const actor = await resolveCartActor();
    if (actor.kind === 'forbidden') return forbiddenCartResponse(actor.role);

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
