import { NextResponse, type NextRequest } from 'next/server';
import {
  getEnquiriesForSupplier,
} from '@/lib/server/enquiries/enquiry-service';
import { requireSupplier } from '@/lib/server/auth/get-session';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSupplier();
    if (!auth.ok) return auth.response;
    const supplier = auth.session.supplier;
    if (!supplier) {
      return NextResponse.json(
        { success: false, error: { message: 'Supplier profile required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    const search = request.nextUrl.searchParams.get('search') || undefined;
    const result = await getEnquiriesForSupplier(supplier.id, { search });
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Suppliers are not permitted to modify enquiries. Enquiries are managed exclusively by administrators.',
        code: 'FORBIDDEN',
      },
    },
    { status: 403 }
  );
}
