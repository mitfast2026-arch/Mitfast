type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || 'MITFAST', email: match[2].trim() };
  }
  return { name: 'MITFAST', email: from.trim() };
}

async function sendWithResend(input: SendMailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const from = process.env.EMAIL_FROM || 'MITFAST <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed: ${response.status} ${body}`);
  }
}

async function sendWithBrevo(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const from = process.env.EMAIL_FROM || 'MITFAST <onboarding@resend.dev>';
  const sender = parseFrom(from);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo failed: ${response.status} ${body}`);
  }
}

/** Primary Resend, fallback Brevo — OTP emails only. */
export async function sendOtpEmail(to: string, code: string): Promise<{ provider: 'resend' | 'brevo' }> {
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

  try {
    await sendWithResend({ to, subject, html });
    return { provider: 'resend' };
  } catch (primaryError) {
    console.error('[sendOtpEmail] Resend failed, trying Brevo:', primaryError);
    await sendWithBrevo({ to, subject, html });
    return { provider: 'brevo' };
  }
}
