/**
 * Shared module-scope settings cache.
 *
 * Solves: Navbar + Footer + Products page all independently call `/api/settings`
 * on every navigation, causing 2–3 redundant DB round trips per page view.
 *
 * Strategy:
 * - First caller fires the fetch and stores a single in-flight Promise.
 * - Subsequent callers within the same page mount receive the same Promise.
 * - Result is cached for `TTL_MS` (5 minutes). Settings rarely change.
 * - No stale data risk: settings only update via admin panel, which clears the cache.
 */

export type SiteSettings = {
  companyName: string;
  logoUrl: string | null;
  productsBannerUrl: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  website: string | null;
  minimumRfqValue: number;
  currency: string;
  googleLoginEnabled?: boolean;
};

type CacheState = {
  data: SiteSettings | null;
  fetchedAt: number;
  inflight: Promise<SiteSettings | null> | null;
};

const TTL_MS = 5 * 60_000; // 5 minutes
const SETTINGS_BUST_KEY = 'mitfast:settings-cache-bust';
const SETTINGS_EVENT = 'mitfast:settings-cache-invalidate';

const state: CacheState = {
  data: null,
  fetchedAt: 0,
  inflight: null,
};

function clearCacheState() {
  state.data = null;
  state.fetchedAt = 0;
  state.inflight = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener(SETTINGS_EVENT, () => clearCacheState());
  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_BUST_KEY) clearCacheState();
  });
}

function isFresh(): boolean {
  return state.data !== null && Date.now() - state.fetchedAt < TTL_MS;
}

async function doFetch(): Promise<SiteSettings | null> {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json?.success && json.data) {
      const s = json.data as SiteSettings;
      state.data = s;
      state.fetchedAt = Date.now();
      return s;
    }
    return null;
  } catch {
    return null;
  } finally {
    state.inflight = null;
  }
}

/**
 * Returns current settings. Deduplicates concurrent calls.
 * Returns cached data immediately if fresh.
 */
export async function getSettings(): Promise<SiteSettings | null> {
  if (isFresh()) return state.data;
  if (state.inflight) return state.inflight;
  state.inflight = doFetch();
  return state.inflight;
}

/**
 * Synchronously peek cached settings without triggering a fetch.
 * Returns null if cache is cold or expired.
 */
export function peekSettings(): SiteSettings | null {
  return isFresh() ? state.data : null;
}

/**
 * Prefetch settings eagerly (fire-and-forget).
 * Call on app mount so data is ready before components need it.
 */
export function prefetchSettings(): void {
  if (typeof window === 'undefined') return;
  if (isFresh() || state.inflight) return;
  void getSettings();
}

/**
 * Invalidate the cache. Call after admin updates settings.
 */
export function invalidateSettings(): void {
  clearCacheState();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  try {
    localStorage.setItem(SETTINGS_BUST_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}
