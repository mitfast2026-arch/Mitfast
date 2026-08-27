import { NextResponse, type NextRequest } from 'next/server';
import {
  createEnquiry,
  getCustomerEnquiries,
  getEnquiriesForAdmin,
} from '@/lib/server/enquiries/enquiry-service';
import { getServerSession, requireAdmin, requireCustomer } from '@/lib/server/auth/get-session';
import type { EnquiryStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (customerId) {
      const auth = await requireCustomer();
      if (!auth.ok) return auth.response;
      if (customerId !== auth.session.profile.id) {
        return NextResponse.json(
          { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } },
          { status: 403 }
        );
      }
      const result = await getCustomerEnquiries(customerId);
      if (!result.success) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const rawStatus = searchParams.get('status');
    const status = (rawStatus && rawStatus !== 'all' ? rawStatus : undefined) as EnquiryStatus | undefined;
    const search = searchParams.get('search') || undefined;

    const result = await getEnquiriesForAdmin({ page, limit, status, search });
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, any> = {};
    let attachment: { buffer: Buffer; fileName: string; contentType: string } | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = {
        productId: form.get('productId') || null,
        message: String(form.get('message') || ''),
        name: String(form.get('name') || form.get('guestName') || ''),
        email: String(form.get('email') || form.get('guestEmail') || ''),
        phone: String(form.get('phone') || form.get('guestPhone') || ''),
        guestName: String(form.get('guestName') || form.get('name') || ''),
        guestEmail: String(form.get('guestEmail') || form.get('email') || ''),
        guestPhone: String(form.get('guestPhone') || form.get('phone') || ''),
        country: String(form.get('country') || ''),
        companyName: String(form.get('companyName') || '') || undefined,
        enquiryType: String(form.get('enquiryType') || '') || undefined,
        customerId: form.get('customerId') || null,
      };
      if (body.productId === '' || body.productId === 'null') body.productId = null;

      const lineItemsRaw = form.get('lineItems');
      if (typeof lineItemsRaw === 'string' && lineItemsRaw.trim()) {
        try {
          body.lineItems = JSON.parse(lineItemsRaw);
        } catch {
          /* ignore malformed lineItems */
        }
      }

      const file = form.get('attachment') || form.get('file');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const f = file as File;
        if (f.size > 0) {
          const buf = Buffer.from(await f.arrayBuffer());
          attachment = {
            buffer: buf,
            fileName: f.name || 'drawing.bin',
            contentType: f.type || 'application/octet-stream',
          };
        }
      }
    } else {
      body = await request.json();
    }

    const session = await getServerSession();
    let customerId = body.customerId || null;

    if (session?.profile.role === 'customer') {
      customerId = session.profile.id;
    } else if (customerId) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized to submit as this customer', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    const { customerId: _ignored, drawingUrl: _drawing, ...enquiryData } = body;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Idempotency-Key header is required for enquiry create',
            code: 'IDEMPOTENCY_REQUIRED',
          },
        },
        { status: 400 }
      );
    }

    const { assertRateLimit } = await import('@/lib/server/db/rate-limit');
    const rateKey =
      customerId ||
      (typeof enquiryData.email === 'string' ? enquiryData.email.toLowerCase() : null) ||
      request.headers.get('x-forwarded-for') ||
      'anon';
    const limited = await assertRateLimit({
      scope: 'enquiry_create',
      key: String(rateKey),
      windowSeconds: 900,
      maxHits: 10,
    });
    if (!limited.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: limited.code === 'RATE_LIMITED' ? 'Too many enquiries' : 'Rate limit unavailable',
            code: limited.code,
          },
        },
        { status: limited.code === 'DATABASE_MISCONFIGURED' ? 503 : 429 }
      );
    }

    const result = await createEnquiry(enquiryData, customerId || null, attachment, idempotencyKey);
    if (!result.success) {
      const status = result.error?.code === 'IDEMPOTENCY_IN_PROGRESS' ? 409 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
