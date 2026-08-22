import { NextResponse, type NextRequest } from 'next/server';
import {
  updateEnquiryStatus,
  deleteEnquiry,
  respondToEnquiry,
} from '@/lib/server/enquiries/enquiry-service';
import { requireAdmin } from '@/lib/server/auth/get-session';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const result = await updateEnquiryStatus({
      enquiryId: params.id,
      status: body.status,
    });

    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const result = await deleteEnquiry(params.id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
