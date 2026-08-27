export type MutationErrorKind =
  | 'validation'
  | 'auth'
  | 'forbidden'
  | 'conflict'
  | 'network'
  | 'server';

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: MutationErrorKind; message: string; code?: string };

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = {
  success: false;
  error?: { message?: string; code?: string };
};

function errorKindFromStatus(status: number, code?: string): MutationErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 400 || code === 'VALIDATION_ERROR') return 'validation';
  return 'server';
}

/**
 * Typed fetch wrapper for portal API routes returning `{ success, data?, error? }`.
 */
export async function apiRequest<T>(
  url: string,
  init?: RequestInit
): Promise<MutationResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      // No forced cache override — allow browser HTTP cache for GETs.
      // Mutations (POST/PUT/DELETE) are naturally non-cacheable by the browser.
    });
    let json: ApiSuccess<T> | ApiFailure | null = null;

    try {
      json = await res.json();
    } catch {
      if (!res.ok) {
        return {
          ok: false,
          kind: errorKindFromStatus(res.status),
          message: res.statusText || 'Request failed',
        };
      }
      return { ok: false, kind: 'server', message: 'Invalid response from server' };
    }

    if (!res.ok || !json || !('success' in json) || !json.success) {
      const code = json && 'error' in json ? json.error?.code : undefined;
      const message =
        (json && 'error' in json && json.error?.message) ||
        res.statusText ||
        'Request failed';
      return {
        ok: false,
        kind: errorKindFromStatus(res.status, code),
        message,
        code,
      };
    }

    return { ok: true, data: json.data };
  } catch (err) {
    console.error('[apiRequest]', url, err);
    return {
      ok: false,
      kind: 'network',
      message: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function apiGet<T>(url: string): Promise<MutationResult<T>> {
  return apiRequest<T>(url);
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  options?: { idempotencyKey?: string }
): Promise<MutationResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  return apiRequest<T>(url, {
    method: 'POST',
    headers: Object.keys(headers).length ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T>(url: string, body: unknown): Promise<MutationResult<T>> {
  return apiRequest<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(url: string): Promise<MutationResult<T>> {
  return apiRequest<T>(url, { method: 'DELETE' });
}
