type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

export type EmailProvider = 'resend' | 'brevo';

export type SendMailResult =
  | { ok: true; provider: EmailProvider }
  | { ok: false; code: 'NOT_CONFIGURED' | 'ALL_FAILED' };

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

/** Returns providers that have credentials present (does not validate keys). */
export function getConfiguredEmailProviders(): EmailProvider[] {
  const providers: EmailProvider[] = [];
  if (process.env.RESEND_API_KEY?.trim()) providers.push('resend');
  if (process.env.BREVO_API_KEY?.trim()) providers.push('brevo');
  return providers;
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
    const body = await response.text();
    throw new Error(`Resend failed: ${response.status} ${body.slice(0, 200)}`);
  }
}

async function sendWithBrevo(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const from = process.env.EMAIL_FROM || 'MITFAST <onboarding@resend.dev>';
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
    const body = await response.text();
    throw new Error(`Brevo failed: ${response.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Primary Resend → fallback Brevo.
 * Skips providers whose credentials are absent. Never returns success without a send.
 */
export async function sendTransactionalEmail(input: SendMailInput): Promise<SendMailResult> {
  const providers = getConfiguredEmailProviders();
  if (providers.length === 0) {
    console.error('[sendTransactionalEmail] No email providers configured (RESEND_API_KEY / BREVO_API_KEY)');
    return { ok: false, code: 'NOT_CONFIGURED' };
  }

  for (const provider of providers) {
    try {
      if (provider === 'resend') {
        await sendWithResend(input);
      } else {
        await sendWithBrevo(input);
      }
      return { ok: true, provider };
    } catch (err) {
      console.error(`[sendTransactionalEmail] ${provider} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.error('[sendTransactionalEmail] All configured providers failed', {
    tried: providers,
  });
  return { ok: false, code: 'ALL_FAILED' };
}
