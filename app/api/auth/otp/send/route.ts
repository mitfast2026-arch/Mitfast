import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOtpEmail } from '@/lib/server/email/send-otp-mail';

const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 5;

/**
 * Generates a Supabase email OTP and sends it via Resend (Brevo fallback).
 * Avoids relying on Supabase built-in SMTP / undeployed Auth hooks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role === 'supplier' ? 'supplier' : 'customer';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: { message: 'Valid email is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentSends } = await (admin as any)
      .from('otp_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', cutoff);

    if ((recentSends ?? 0) >= OTP_MAX_SENDS_PER_WINDOW) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Too many verification requests. Try again later.', code: 'RATE_LIMITED' },
        },
        { status: 429 }
      );
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: { role },
      },
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'AUTH_ERROR' } },
        { status: 400 }
      );
    }

    const otp = data?.properties?.email_otp;
    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Could not generate verification code', code: 'OTP_MISSING' },
        },
        { status: 500 }
      );
    }

    const { provider } = await sendOtpEmail(email, otp);

    await (admin as any).from('otp_send_log').insert({ email });

    return NextResponse.json({
      success: true,
      data: { sent: true, provider },
    });
  } catch (error) {
    console.error('[POST /api/auth/otp/send]', error);
    const message = error instanceof Error ? error.message : 'Failed to send verification code';
    return NextResponse.json(
      { success: false, error: { message, code: 'EMAIL_ERROR' } },
      { status: 500 }
    );
  }
}
