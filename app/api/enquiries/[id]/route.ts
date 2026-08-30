import { NextResponse, type NextRequest } from 'next/server';
import {
  getEnquiryDetail,
  updateEnquiryStatus,
  deleteEnquiry,
  respondToEnquiry,
  updateEnquiryDetails,
} from '@/lib/server/enquiries/enquiry-service';
import {
  getServerSession,
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/server/auth/get-session';

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const role = session.profile.role;
    if (role === 'admin') {
      const result = await getEnquiryDetail(params.id, { isAdmin: true });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (role === 'customer') {
      const result = await getEnquiryDetail(params.id, { customerId: session.profile.id });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    if (role === 'supplier') {
      if (!session.supplier || session.supplier.status !== 'active') {
        return forbiddenResponse();
      }
      const result = await getEnquiryDetail(params.id, { supplierId: session.supplier.id });
      if (!result.success) {
        const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'FORBIDDEN' ? 403 : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    return forbiddenResponse();
  } catch (error) {
    console.error('[GET /api/enquiries/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const body = await request.json();

    if (typeof body.responseMessage === 'string' && body.responseMessage.trim()) {
      const result = await respondToEnquiry(
        {
          enquiryId: params.id,
          responseMessage: body.responseMessage,
          status: body.status,
        },
        auth.session.profile.id
      );
      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    if (
      body.guestName !== undefined ||
      body.guestEmail !== undefined ||
      body.guestPhone !== undefined ||
      body.country !== undefined ||
      body.companyName !== undefined ||
      body.message !== undefined ||
      body.enquiryType !== undefined ||
      body.productId !== undefined ||
      body.lineItems !== undefined
    ) {
      const result = await updateEnquiryDetails({
        enquiryId: params.id,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        guestPhone: body.guestPhone,
        country: body.country,
        companyName: body.companyName,
        message: body.message,
        enquiryType: body.enquiryType,
        productId: body.productId,
        lineItems: body.lineItems,
      });
      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    const result = await updateEnquiryStatus({
      enquiryId: params.id,
      status: body.status,
    });

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[PUT /api/enquiries/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const result = await deleteEnquiry(params.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[DELETE /api/enquiries/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
