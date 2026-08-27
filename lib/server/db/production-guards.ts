/**
 * Production fail-closed helpers for missing RPCs / schema drift.
 * Unsafe multi-step fallbacks must not run on Vercel production.
 */

export function isProductionEnvironment(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

export function isRpcMissing(
  error: { code?: string; message?: string } | null | undefined,
  functionName?: string
): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.code === 'PGRST202' ||
    msg.includes('Could not find the function') ||
    (functionName ? msg.includes(functionName) : false)
  );
}

export function databaseMisconfiguredError(feature: string): {
  success: false;
  error: { message: string; code: 'DATABASE_MISCONFIGURED' };
} {
  return {
    success: false,
    error: {
      message: `${feature} requires database migrations that are not applied. Run npm run db:push.`,
      code: 'DATABASE_MISCONFIGURED',
    },
  };
}

/** Allow multi-step fallbacks only outside production. */
export function allowUnsafeDbFallback(): boolean {
  return !isProductionEnvironment();
}
