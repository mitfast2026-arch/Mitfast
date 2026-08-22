import { NextResponse, type NextRequest } from 'next/server';
import {
  getEnquiriesForSupplier,
  respondToEnquiry,
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

export async function PUT(request: NextRequest) {
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
    const body = await request.json();

    const result = await respondToEnquiry(
      {
        enquiryId: body.enquiryId,
        responseMessage: body.responseMessage,
        status: body.status,
      },
      auth.session.profile.id,
      { supplierId: supplier.id }
    );

    if (!result.success) {
      const status =
        result.error?.code === 'FORBIDDEN'
          ? 403
          : result.error?.code === 'NOT_FOUND'
            ? 404
            : 400;
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
