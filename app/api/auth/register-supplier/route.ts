import { NextResponse, type NextRequest } from 'next/server';
import { submitSupplierApplication } from '@/lib/server/auth/supplier-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await submitSupplierApplication(body);

    if (!result.success) {
      const status = result.error?.code === 'UNAUTHORIZED' ? 401 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
