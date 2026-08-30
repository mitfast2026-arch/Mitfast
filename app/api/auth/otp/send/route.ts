import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOtpEmail } from '@/lib/server/email/send-otp-mail';
import { getConfiguredEmailProviders } from '@/lib/server/email/send-transactional-mail';
import { allowUnsafeDbFallback, isRpcMissing } from '@/lib/server/db/production-guards';
import { getPortalMismatchError, type PortalRole } from '@/lib/auth/portal-role';

const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const OTP_MAX_SENDS_PER_WINDOW = 5;

type AdminClient = ReturnType<typeof createAdminClient>;

function formatRetryMessage(retryAfterSeconds: number): string {
  const mins = Math.floor(retryAfterSeconds / 60);
  const secs = retryAfterSeconds % 60;
  if (mins <= 0) {
    return `Too many verification requests. Try again in ${secs}s.`;
  }
  if (secs === 0) {
    return `Too many verification requests. Try again in ${mins} min.`;
  }
  return `Too many verification requests. Try again in ${mins} min ${secs}s.`;
}

async function getOtpRetryAfterSeconds(admin: AdminClient, email: string): Promise<number> {
  const cutoff = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: oldest } = await (admin as any)
    .from('otp_send_log')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!oldest?.created_at) return OTP_RATE_LIMIT_WINDOW_SECONDS;
  const unlockAt = new Date(oldest.created_at).getTime() + OTP_RATE_LIMIT_WINDOW_MS;
  return Math.max(30, Math.ceil((unlockAt - Date.now()) / 1000));
}

async function rateLimitedResponse(admin: AdminClient, email: string) {
  const retryAfterSeconds = await getOtpRetryAfterSeconds(admin, email);
  return NextResponse.json(
    {
      success: false,
      error: {
        message: formatRetryMessage(retryAfterSeconds),
        code: 'RATE_LIMITED',
        retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}

/**
 * Generates a Supabase email OTP and sends it via Resend (Brevo fallback).
 * Rate-limit slots are released if delivery fails so failed sends do not permanently consume quota.
 */
export async function POST(request: NextRequest) {
  let reservedLogId: string | null = null;
  let admin: AdminClient | null = null;
  let email = '';

  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role === 'supplier' ? 'supplier' : 'customer';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: { message: 'Valid email is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const configured = getConfiguredEmailProviders();
    if (configured.length === 0) {
      console.error('[POST /api/auth/otp/send] EMAIL_NOT_CONFIGURED');
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Email delivery is temporarily unavailable. Please try again later.',
            code: 'EMAIL_NOT_CONFIGURED',
          },
        },
        { status: 503 }
      );
    }

    try {
      admin = createAdminClient();
    } catch (err) {
      console.error('[POST /api/auth/otp/send] admin client unavailable', err instanceof Error ? err.message : err);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Unable to send verification code. Try again later.', code: 'AUTH_CONFIG_ERROR' },
        },
        { status: 503 }
      );
    }

    const { data: existingProfile } = await (admin as any)
      .from('profiles')
      .select('id, role')
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile?.role) {
      const intendedPortal: PortalRole = role === 'supplier' ? 'supplier' : 'buyer';
      const mismatch = getPortalMismatchError(intendedPortal, existingProfile.role);
      if (mismatch) {
        return NextResponse.json(
          {
            success: false,
            error: { message: mismatch, code: 'ROLE_LOCKED' },
          },
          { status: 403 }
        );
      }
    }

    const { data: allowed, error: limitError } = await (admin as any).rpc('try_record_otp_send', {
      p_email: email,
      p_window_seconds: OTP_RATE_LIMIT_WINDOW_SECONDS,
      p_max_sends: OTP_MAX_SENDS_PER_WINDOW,
    });

    let recordedAtomically = false;

    if (!limitError) {
      recordedAtomically = true;
      if (allowed !== true) {
        return rateLimitedResponse(admin, email);
      }
      // Capture newest log row so we can release on delivery failure
      const { data: reserved } = await (admin as any)
        .from('otp_send_log')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      reservedLogId = reserved?.id ?? null;
    } else {
      if (isRpcMissing(limitError, 'try_record_otp_send')) {
        if (!allowUnsafeDbFallback()) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: 'Unable to send verification code. Try again later.',
                code: 'DATABASE_MISCONFIGURED',
              },
            },
            { status: 503 }
          );
        }
      } else {
        console.error('[POST /api/auth/otp/send] rate-limit RPC', limitError.message || limitError);
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Unable to send verification code. Try again later.', code: 'DATABASE_ERROR' },
          },
          { status: 500 }
        );
      }

      const cutoff = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS).toISOString();
      const { count: recentSends } = await (admin as any)
        .from('otp_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .gte('created_at', cutoff);

      if ((recentSends ?? 0) >= OTP_MAX_SENDS_PER_WINDOW) {
        return rateLimitedResponse(admin, email);
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: { role },
      },
    });

    if (error) {
      console.error('[POST /api/auth/otp/send] generateLink', error.message);
      await releaseOtpReservation(admin, reservedLogId, recordedAtomically, email);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Unable to send verification code. Try again later.', code: 'AUTH_ERROR' },
        },
        { status: 400 }
      );
    }

    const otp = data?.properties?.email_otp;
    if (!otp) {
      console.error('[POST /api/auth/otp/send] OTP_MISSING from generateLink');
      await releaseOtpReservation(admin, reservedLogId, recordedAtomically, email);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Could not generate verification code', code: 'OTP_MISSING' },
        },
        { status: 500 }
      );
    }

    // Never log or return the OTP value
    const sendResult = await sendOtpEmail(email, otp);

    if (!sendResult.ok) {
      await releaseOtpReservation(admin, reservedLogId, recordedAtomically, email);
      const status = sendResult.code === 'NOT_CONFIGURED' ? 503 : 502;
      console.error('[POST /api/auth/otp/send] delivery failed', {
        code: sendResult.code,
        errorDetails: sendResult.errorDetails,
        providers: configured,
      });

      let userFriendlyMessage = 'Unable to send verification code. Please check your email configuration or try again later.';
      const errLower = (sendResult.errorDetails || '').toLowerCase();
      if (errLower.includes('not verified') || errLower.includes('unverified')) {
        userFriendlyMessage = 'Email sending domain is awaiting DNS verification in Resend. Please verify your custom domain DNS records.';
      } else if (errLower.includes('only send testing emails')) {
        userFriendlyMessage = 'Email sending is in test mode. Please verify your custom domain in Resend or use your registered test email.';
      } else if (errLower.includes('unauthorised_ips') || errLower.includes('unrecognised ip')) {
        userFriendlyMessage = 'Email provider IP authorization required. Please check your provider settings.';
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            message: userFriendlyMessage,
            code: sendResult.code === 'NOT_CONFIGURED' ? 'EMAIL_NOT_CONFIGURED' : 'EMAIL_DELIVERY_FAILED',
            details: process.env.NODE_ENV !== 'production' ? sendResult.errorDetails : undefined,
          },
        },
        { status }
      );
    }

    if (!recordedAtomically) {
      await (admin as any).from('otp_send_log').insert({ email });
    }

    return NextResponse.json({
      success: true,
      data: { sent: true, provider: sendResult.provider },
    });
  } catch (error) {
    console.error('[POST /api/auth/otp/send]', error instanceof Error ? error.message : error);
    if (admin) {
      await releaseOtpReservation(admin, reservedLogId, Boolean(reservedLogId), email);
    }
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Unable to send verification code. Try again later.', code: 'EMAIL_ERROR' },
      },
      { status: 500 }
    );
  }
}

/** Release a rate-limit reservation when OTP was not actually delivered. */
async function releaseOtpReservation(
  admin: AdminClient,
  reservedLogId: string | null,
  recordedAtomically: boolean,
  email: string
): Promise<void> {
  if (!recordedAtomically) return;
  try {
    if (reservedLogId) {
      await (admin as any).from('otp_send_log').delete().eq('id', reservedLogId);
      return;
    }
    if (!email) return;
    const { data: latest } = await (admin as any)
      .from('otp_send_log')
      .select('id')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) {
      await (admin as any).from('otp_send_log').delete().eq('id', latest.id);
    }
  } catch (err) {
    console.error('[otp/send] failed to release rate-limit slot', err instanceof Error ? err.message : err);
  }
}
