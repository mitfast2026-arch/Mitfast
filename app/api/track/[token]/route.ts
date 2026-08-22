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
    const { data: order, error } = await adminClient
      .from('orders')
      .select(`
        order_number,
        status,
        payment_status,
        subtotal,
        total,
        created_at,
        updated_at,
        items:order_items(product_name_snapshot, quantity)
      `)
      .eq('tracking_token', token)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: { message: 'Order not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const orderData = order as any;
    return NextResponse.json({
      success: true,
      data: {
        type: 'order',
        orderNumber: orderData.order_number,
        status: orderData.status,
        paymentStatus: orderData.payment_status,
        subtotal: orderData.subtotal,
        total: orderData.total,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at,
        items: (orderData.items || []).map((item: any) => ({
          name: item.product_name_snapshot,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
