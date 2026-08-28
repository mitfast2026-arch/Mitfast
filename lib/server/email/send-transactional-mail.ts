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

async function sendWithResend(input: SendMailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
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
    throw new Error(`Resend failed: ${response.status} ${body}`);
  }
}

async function sendWithBrevo(input: SendMailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
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
    throw new Error(`Brevo failed: ${response.status} ${body}`);
  }
}

/** Primary Resend, fallback Brevo. */
export async function sendTransactionalEmail(
  input: SendMailInput
): Promise<{ provider: 'resend' | 'brevo' } | null> {
  if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY) {
    return null;
  }

  try {
    await sendWithResend(input);
    return { provider: 'resend' };
  } catch (primaryError) {
    console.error('[sendTransactionalEmail] Resend failed, trying Brevo:', primaryError);
    try {
      await sendWithBrevo(input);
      return { provider: 'brevo' };
    } catch (fallbackError) {
      console.error('[sendTransactionalEmail] Brevo failed:', fallbackError);
      return null;
    }
  }
}
