import { NextResponse, type NextRequest } from 'next/server';
import {
  getCustomerCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCustomerCart,
} from '@/lib/server/cart/cart-service';
import { requireCustomer } from '@/lib/server/auth/get-session';

export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const result = await getCustomerCart(auth.session.profile.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing productId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await addToCart(auth.session.profile.id, productId, quantity || 1);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { cartItemId, quantity } = body;

    if (!cartItemId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing cartItemId or quantity', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await updateCartItemQuantity(auth.session.profile.id, cartItemId, quantity);
    if (!result.success) {
      const status = result.error?.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const cartItemId = searchParams.get('cartItemId');
    const clearAll = searchParams.get('clear');

    if (cartItemId) {
      const result = await removeCartItem(auth.session.profile.id, cartItemId);
      if (!result.success) {
        const status = result.error?.code === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (clearAll === '1' || clearAll === 'true') {
      await clearCustomerCart(auth.session.profile.id);
      return NextResponse.json({ success: true, data: { cleared: true } });
    }

    return NextResponse.json(
      { success: false, error: { message: 'cartItemId or clear is required', code: 'VALIDATION_ERROR' } },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
