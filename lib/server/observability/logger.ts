/**
 * Structured production logging. Optional Sentry when SENTRY_DSN is set
 * (uses Sentry HTTP ingest via fetch — no hard dependency required at build time).
 */

type LogLevel = 'error' | 'warn' | 'info';

export function logServerEvent(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
) {
  const payload = {
    level,
    message,
    requestId: context?.requestId ?? null,
    ...context,
    ts: new Date().toISOString(),
  };

  if (level === 'error') console.error('[mitfast]', payload);
  else if (level === 'warn') console.warn('[mitfast]', payload);
  else console.info('[mitfast]', payload);

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn && level === 'error') {
    void reportToSentry(dsn, message, context).catch(() => {
      /* never break request path */
    });
  }
}

async function reportToSentry(
  dsn: string,
  message: string,
  context?: Record<string, unknown>
) {
  // DSN format: https://<key>@o<org>.ingest.sentry.io/<project>
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return;
  const [, key, host, projectId] = match;
  const url = `https://${host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      level: 'error',
      platform: 'node',
      timestamp: Date.now() / 1000,
      tags: { app: 'mitfast-b2b' },
      extra: context || {},
    }),
  });
}
