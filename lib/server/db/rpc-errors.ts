/** Map Postgres / Supabase RPC errors to application error codes. */

export function mapRpcError(error: { code?: string; message?: string } | null): {
  message: string;
  code: string;
} {
  const msg = error?.message || 'Database operation failed';
  const pgCode = error?.code || '';

  if (pgCode === '23505' || msg.includes('already converted')) {
    return { message: 'This record has already been converted', code: 'ALREADY_CONVERTED' };
  }
  if (pgCode === 'check_violation' || msg.includes('must be accepted') || msg.includes('cannot be converted')) {
    return { message: msg, code: 'INVALID_STATUS' };
  }
  if (pgCode === 'P0002' || msg.includes('not found')) {
    return { message: msg, code: 'NOT_FOUND' };
  }
  if (msg.includes('status changed during')) {
    return { message: msg, code: 'CONFLICT' };
  }

  return { message: msg, code: 'DATABASE_ERROR' };
}

export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '23505' || (error.message?.includes('duplicate key') ?? false);
}
