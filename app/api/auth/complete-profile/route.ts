import { NextResponse, type NextRequest } from 'next/server';
import { completeUserProfile } from '@/lib/server/auth/customer-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const intendedRole =
      body.intendedRole === 'supplier' || body.role === 'supplier'
        ? 'supplier'
        : body.intendedRole === 'customer' || body.role === 'buyer' || body.role === 'customer'
          ? 'customer'
          : undefined;

    const result = await completeUserProfile(body, { intendedRole });

    if (!result.success) {
      const status = result.error?.code === 'UNAUTHORIZED' ? 401 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
