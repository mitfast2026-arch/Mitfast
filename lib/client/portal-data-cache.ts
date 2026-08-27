import { apiGet, type MutationResult } from '@/lib/client/api-client';

type CacheEntry = {
  data: unknown;
  fetchedAt: number;
  inflight?: Promise<MutationResult<unknown>>;
};

const STALE_MS = 45_000;
const TTL_MS = 5 * 60_000;

const store = new Map<string, CacheEntry>();

function isFresh(entry: CacheEntry, now = Date.now()) {
  return now - entry.fetchedAt < STALE_MS;
}

function isUsable(entry: CacheEntry, now = Date.now()) {
  return now - entry.fetchedAt < TTL_MS;
}

/** Peek cached payload without fetching. */
export function peekPortalCache<T>(key: string): { data: T; stale: boolean } | null {
  const entry = store.get(key);
  if (!entry || !isUsable(entry)) return null;
  return { data: entry.data as T, stale: !isFresh(entry) };
}

export function setPortalCache(key: string, data: unknown) {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidatePortalCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix) || key.includes(prefix)) {
      store.delete(key);
    }
  }
}

async function fetchAndStore<T>(url: string): Promise<MutationResult<T>> {
  const result = await apiGet<T>(url);
  if (result.ok) {
    setPortalCache(url, result.data);
  }
  return result;
}

/**
 * Session-scoped GET with stale-while-revalidate.
 * Returns cached data immediately when available; revalidates in background when stale.
 */
export async function cachedApiGet<T>(
  url: string,
  opts?: { force?: boolean }
): Promise<MutationResult<T>> {
  const now = Date.now();
  const entry = store.get(url);

  if (
    !opts?.force &&
    entry &&
    entry.data !== undefined &&
    isUsable(entry, now)
  ) {
    if (!isFresh(entry, now) && !entry.inflight) {
      entry.inflight = fetchAndStore<T>(url).finally(() => {
        const current = store.get(url);
        if (current) delete current.inflight;
      }) as Promise<MutationResult<unknown>>;
    }
    return { ok: true, data: entry.data as T };
  }

  if (entry?.inflight) {
    return entry.inflight as Promise<MutationResult<T>>;
  }

  const inflight = fetchAndStore<T>(url).finally(() => {
    const current = store.get(url);
    if (current) delete current.inflight;
  });

  if (entry) {
    entry.inflight = inflight as Promise<MutationResult<unknown>>;
  } else {
    store.set(url, {
      data: undefined,
      fetchedAt: 0,
      inflight: inflight as Promise<MutationResult<unknown>>,
    });
  }

  return inflight as Promise<MutationResult<T>>;
}

/** Fire-and-forget prefetch for hover intent. */
export function prefetchPortalData(url: string) {
  if (typeof window === 'undefined') return;
  const entry = store.get(url);
  if (entry && isFresh(entry)) return;
  if (entry?.inflight) return;
  void cachedApiGet(url);
}

export function markPortalNavClick(href: string) {
  if (typeof performance === 'undefined') return;
  try {
    performance.clearMarks(`portal-nav-click:${href}`);
    performance.clearMeasures(`portal-nav:${href}`);
    performance.mark(`portal-nav-click:${href}`);
  } catch {
    // ignore
  }
}

export function markPortalContentReady(href: string) {
  if (typeof performance === 'undefined') return;
  try {
    const clickMark = `portal-nav-click:${href}`;
    if (!performance.getEntriesByName(clickMark).length) return;
    performance.mark(`portal-nav-ready:${href}`);
    performance.measure(`portal-nav:${href}`, clickMark, `portal-nav-ready:${href}`);
    const measures = performance.getEntriesByName(`portal-nav:${href}`);
    const last = measures[measures.length - 1];
    if (last && process.env.NODE_ENV !== 'production') {
      console.info(
        `[portal-perf] ${href} click→content ${Math.round(last.duration)}ms`
      );
    }
  } catch {
    // ignore
  }
}
