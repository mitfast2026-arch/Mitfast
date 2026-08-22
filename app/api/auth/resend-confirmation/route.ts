import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmailRedirectTo } from '@/lib/server/auth/site-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json(
        { success: false, error: { message: 'Email is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const origin = request.headers.get('origin');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getEmailRedirectTo(origin) },
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'AUTH_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { sent: true } });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
