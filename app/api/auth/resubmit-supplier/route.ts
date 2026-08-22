import { NextResponse, type NextRequest } from 'next/server';
import { resubmitSupplierApplication } from '@/lib/server/auth/supplier-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, ...formData } = body;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing supplierId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const result = await resubmitSupplierApplication(supplierId, formData);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
