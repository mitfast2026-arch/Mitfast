import { NextResponse, type NextRequest } from 'next/server';
import { registerSupplier, resubmitSupplierApplication } from '@/lib/server/auth/supplier-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await registerSupplier(body, { origin: request.headers.get('origin') });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
