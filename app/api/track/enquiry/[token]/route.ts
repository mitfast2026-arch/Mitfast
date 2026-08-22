import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token?.trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Tracking token required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: enquiry, error } = await adminClient
      .from('enquiries')
      .select('id, status, guest_name, guest_email, message, created_at, updated_at, response_message, responded_at, product:products(id, name), tracking_token')
      .eq('tracking_token', token)
      .maybeSingle();

    if (error || !enquiry) {
      return NextResponse.json(
        { success: false, error: { message: 'Enquiry not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const { data: order } = await adminClient
      .from('orders')
      .select('order_number, status, payment_status, tracking_token, created_at')
      .eq('enquiry_id', enquiry.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        type: 'enquiry',
        status: enquiry.status,
        createdAt: enquiry.created_at,
        updatedAt: enquiry.updated_at,
        guestName: enquiry.guest_name,
        message: enquiry.message,
        responseMessage: (enquiry as any).response_message || null,
        respondedAt: (enquiry as any).responded_at || null,
        productName: (enquiry as any).product?.name || null,
        contactEmail: enquiry.guest_email,
        order: order
          ? {
              orderNumber: order.order_number,
              status: order.status,
              paymentStatus: order.payment_status,
              trackingToken: order.tracking_token,
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
