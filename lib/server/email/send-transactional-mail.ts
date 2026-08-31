import nodemailer from 'nodemailer';

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

export type EmailProvider = 'smtp' | 'brevo' | 'resend';

export type SendMailResult =
  | { ok: true; provider: EmailProvider }
  | { ok: false; code: 'NOT_CONFIGURED' | 'ALL_FAILED'; errorDetails?: string };

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || 'MITFAST', email: match[2].trim() };
  }
  return { name: 'MITFAST', email: from.trim() };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Returns providers that have credentials present in order of priority: SMTP -> Brevo -> Resend */
export function getConfiguredEmailProviders(): EmailProvider[] {
  const providers: EmailProvider[] = [];
  const smtpUser = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim();
  if (smtpUser && smtpPass) providers.push('smtp');
  if (process.env.BREVO_API_KEY?.trim()) providers.push('brevo');
  if (process.env.RESEND_API_KEY?.trim()) providers.push('resend');
  return providers;
}

let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT?.trim()) || 465;
  const secure = port === 465;
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const pass = (process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim() || '').replace(/\s+/g, '');

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return smtpTransporter;
}

async function sendWithSmtp(input: SendMailInput): Promise<void> {
  const user = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) throw new Error('SMTP credentials are not configured');

  const from = process.env.EMAIL_FROM || `MITFAST <${user}>`;
  const transporter = getSmtpTransporter();

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

async function sendWithResend(input: SendMailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const from = process.env.EMAIL_FROM || 'MITFAST <onboarding@resend.dev>';
  const response = await fetchWithTimeout(
    'https://api.resend.com/emails',
    {
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
    },
    10_000
  );

  if (!response.ok) {
    const rawBody = await response.text();
    let parsedMessage = rawBody.slice(0, 300);
    try {
      const json = JSON.parse(rawBody);
      parsedMessage = json.message || json.error?.message || parsedMessage;
    } catch {
      /* use raw snippet */
    }
    throw new Error(`Resend failed (${response.status}): ${parsedMessage}`);
  }
}

async function sendWithBrevo(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const from = process.env.EMAIL_FROM || 'MITFAST <mitfast2026@gmail.com>';
  const sender = parseFrom(from);

  const response = await fetchWithTimeout(
    'https://api.brevo.com/v3/smtp/email',
    {
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
    },
    10_000
  );

  if (!response.ok) {
    const rawBody = await response.text();
    let parsedMessage = rawBody.slice(0, 300);
    try {
      const json = JSON.parse(rawBody);
      parsedMessage = json.message || json.error?.message || parsedMessage;
    } catch {
      /* use raw snippet */
    }
    throw new Error(`Brevo failed (${response.status}): ${parsedMessage}`);
  }
}

/**
 * Multi-provider fallback:
 * 1. Primary: Direct Gmail SMTP (works globally to any recipient without domain)
 * 2. Fallback: Brevo API
 * 3. Fallback: Resend API
 */
export async function sendTransactionalEmail(input: SendMailInput): Promise<SendMailResult> {
  const providers = getConfiguredEmailProviders();
  if (providers.length === 0) {
    console.error('[sendTransactionalEmail] No email providers configured');
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      errorDetails: 'Email service credentials (SMTP / BREVO / RESEND) are not set',
    };
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      if (provider === 'smtp') {
        await sendWithSmtp(input);
      } else if (provider === 'brevo') {
        await sendWithBrevo(input);
      } else {
        await sendWithResend(input);
      }
      return { ok: true, provider };
    } catch (err) {
      const msg = err instanceof Error ? err.name : 'UnknownError';
      console.error(`[sendTransactionalEmail] ${provider} delivery failed (${msg})`);
      errors.push(`${provider}: delivery failed`);
    }
  }

  console.error('[sendTransactionalEmail] All configured providers failed', {
    tried: providers,
  });
  return { ok: false, code: 'ALL_FAILED', errorDetails: errors.join(' | ') };
}
