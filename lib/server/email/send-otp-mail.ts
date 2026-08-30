import {
  sendTransactionalEmail,
  type EmailProvider,
} from '@/lib/server/email/send-transactional-mail';

export type SendOtpResult =
  | { ok: true; provider: EmailProvider }
  | { ok: false; code: 'NOT_CONFIGURED' | 'ALL_FAILED'; errorDetails?: string };

/** Primary Resend, fallback Brevo — OTP emails only. Never logs the code. */
export async function sendOtpEmail(to: string, code: string): Promise<SendOtpResult> {
  const subject = 'Your MITFAST verification code';
  const html = `
    <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">MITFAST B2B</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#111315;">Verification code</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4B5563;">
        Enter this code to sign in. It expires shortly.
      </p>
      <p style="margin:0 0 24px;font-size:34px;letter-spacing:0.35em;font-weight:700;color:#111315;">${code}</p>
      <p style="margin:0;font-size:12px;color:#9CA3AF;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const result = await sendTransactionalEmail({ to, subject, html });
  if (!result.ok) {
    return { ok: false, code: result.code, errorDetails: result.errorDetails };
  }
  return { ok: true, provider: result.provider };
}
