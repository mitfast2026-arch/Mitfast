import { createBrowserClient } from '@/lib/supabase/client';

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

function handleAuthExpiry() {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('portal-auth-expired'));

  const pathname = window.location.pathname;
  const isProtectedPortal =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/supplier') ||
    pathname.startsWith('/customer');

  if (isProtectedPortal && !(window as any).__mf_auth_redirecting) {
    (window as any).__mf_auth_redirecting = true;
    const role = pathname.startsWith('/admin')
      ? 'admin'
      : pathname.startsWith('/supplier')
        ? 'supplier'
        : 'buyer';

    const redirectPath = encodeURIComponent(window.location.pathname + window.location.search);
    const target = `/auth?role=${role === 'admin' ? 'admin' : role}&mode=signin&redirect=${redirectPath}`;

    setTimeout(() => {
      window.location.assign(target);
    }, 1200);
  }
}

/**
 * Typed fetch wrapper for portal API routes returning `{ success, data?, error? }`.
 * Automatically attempts session refresh on 401 and handles auth expiration.
 */
export async function apiRequest<T>(
  url: string,
  init?: RequestInit & { _isRetry?: boolean }
): Promise<MutationResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      // No forced cache override — allow browser HTTP cache for GETs.
      // Mutations (POST/PUT/DELETE) are naturally non-cacheable by the browser.
    });

    // If 401 Unauthorized on client, attempt silent session refresh and retry once
    if (res.status === 401 && typeof window !== 'undefined' && !init?._isRetry) {
      try {
        const supabase = createBrowserClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
          return await apiRequest<T>(url, { ...init, _isRetry: true });
        }
      } catch (refreshErr) {
        console.warn('[apiRequest] Silent session refresh failed:', refreshErr);
      }

      handleAuthExpiry();
      return {
        ok: false,
        kind: 'auth',
        message: 'Your session has expired. Please sign in again.',
        code: 'UNAUTHORIZED',
      };
    }

    let json: ApiSuccess<T> | ApiFailure | null = null;

    try {
      json = await res.json();
    } catch {
      if (!res.ok) {
        if (res.status === 401) {
          handleAuthExpiry();
        }
        return {
          ok: false,
          kind: errorKindFromStatus(res.status),
          message:
            res.status === 401
              ? 'Your session has expired. Please sign in again.'
              : res.statusText || 'Request failed',
        };
      }
      return { ok: false, kind: 'server', message: 'Invalid response from server' };
    }

    if (!res.ok || !json || !('success' in json) || !json.success) {
      const code = json && 'error' in json ? json.error?.code : undefined;
      const rawMessage = json && 'error' in json ? json.error?.message : undefined;
      const message =
        res.status === 401
          ? 'Your session has expired. Please sign in again.'
          : rawMessage || res.statusText || 'Request failed';

      if (res.status === 401) {
        handleAuthExpiry();
      }

      return {
        ok: false,
        kind: errorKindFromStatus(res.status, code),
        message,
        code,
      };
    }

    if (init?.method && init.method !== 'GET') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portal-mutation-success', { detail: { url, method: init.method } }));
      }
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
