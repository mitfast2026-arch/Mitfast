import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from '@/lib/server/auth/get-session';
import { ensureGuestSessionId } from '@/lib/server/guest/session';
import {
  getCustomerWishlist,
  getGuestWishlist,
  addToCustomerWishlist,
  addToGuestWishlist,
  removeCustomerWishlistItem,
  removeGuestWishlistItem,
} from '@/lib/server/guest/wishlist-service';

async function resolveWishlistActor() {
  const session = await getServerSession();
  if (session?.profile.role === 'customer') {
    return { kind: 'customer' as const, customerId: session.profile.id };
  }
  const guestSessionId = await ensureGuestSessionId();
  return { kind: 'guest' as const, guestSessionId };
}

export async function GET() {
  try {
    const actor = await resolveWishlistActor();
    const result =
      actor.kind === 'customer'
        ? await getCustomerWishlist(actor.customerId)
        : await getGuestWishlist(actor.guestSessionId);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({
      ...result,
      data: { ...result.data, isGuest: actor.kind === 'guest' },
    });
  } catch (error) {
    console.error('[GET /api/wishlist]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = body.productId as string | undefined;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing productId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const actor = await resolveWishlistActor();
    const result =
      actor.kind === 'customer'
        ? await addToCustomerWishlist(actor.customerId, productId)
        : await addToGuestWishlist(actor.guestSessionId, productId);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[POST /api/wishlist]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const productId = new URL(request.url).searchParams.get('productId');
    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: 'productId is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const actor = await resolveWishlistActor();
    const result =
      actor.kind === 'customer'
        ? await removeCustomerWishlistItem(actor.customerId, productId)
        : await removeGuestWishlistItem(actor.guestSessionId, productId);

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[DELETE /api/wishlist]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
