import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend@4.0.0';

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';
const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'MITFAST <onboarding@resend.dev>';
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
};

function otpHtml(token: string, actionType: string): string {
  const label =
    actionType === 'recovery'
      ? 'password reset'
      : actionType === 'email_change'
        ? 'email change'
        : 'sign-in';
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 12px; color: #111315;">Your MITFAST verification code</h2>
      <p style="margin: 0 0 16px; color: #4B5563; font-size: 14px;">
        Use this one-time code to complete your ${label}. It expires shortly.
      </p>
      <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #111315; margin: 24px 0;">
        ${token}
      </p>
      <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
        If you did not request this, you can ignore this email.
      </p>
    </div>
  `;
}

async function sendWithResend(to: string, subject: string, html: string): Promise<void> {
  if (!resendApiKey) throw new Error('RESEND_API_KEY missing');
  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: emailFrom,
    to: [to],
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<void> {
  if (!brevoApiKey) throw new Error('BREVO_API_KEY missing');
  const match = emailFrom.match(/^(.*)<([^>]+)>$/);
  const senderName = match ? match[1].trim() : 'MITFAST';
  const senderEmail = match ? match[2].trim() : emailFrom.trim();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName || 'MITFAST', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo send failed: ${response.status} ${body}`);
  }
}

async function sendOtpEmail(to: string, emailData: EmailData): Promise<void> {
  const token = emailData.token || emailData.token_new;
  if (!token) throw new Error('No OTP token in hook payload');

  const subject = 'Your MITFAST verification code';
  const html = otpHtml(token, emailData.email_action_type);

  try {
    await sendWithResend(to, subject, html);
  } catch (primaryError) {
    console.error('[send-email] Resend failed, trying Brevo:', primaryError);
    await sendWithBrevo(to, subject, html);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    if (!hookSecret) throw new Error('SEND_EMAIL_HOOK_SECRET missing');
    const wh = new Webhook(hookSecret);
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: EmailData;
    };

    if (!user?.email) throw new Error('Missing user email');
    await sendOtpEmail(user.email, email_data);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-email] error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
