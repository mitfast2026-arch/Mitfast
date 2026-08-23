'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
  setPortalCache,
} from '@/lib/client/portal-data-cache';
import type { MutationResult } from '@/lib/client/api-client';

type Options = {
  /** Route path for perf logging (e.g. /admin/dashboard) */
  routeHref?: string;
  enabled?: boolean;
};

/**
 * Portal GET with session cache: paint cached data immediately, revalidate in background.
 */
export function usePortalCachedGet<T>(url: string | null, opts?: Options) {
  const enabled = opts?.enabled !== false && Boolean(url);
  const initial = url ? peekPortalCache<T>(url) : null;
  const [data, setData] = useState<T | null>(initial?.data ?? null);
  const [loading, setLoading] = useState(enabled && !initial);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(
    async (showLoading = true) => {
      if (!url || !enabled) return null;
      const cached = peekPortalCache<T>(url);
      if (cached && showLoading) {
        setData(cached.data);
        setLoading(false);
      } else if (showLoading && !cached) {
        setLoading(true);
      }
      setError(null);
      const result = await cachedApiGet<T>(url, { force: !cached || cached.stale });
      if (urlRef.current !== url) return result;
      if (result.ok) {
        setData(result.data);
        if (opts?.routeHref) markPortalContentReady(opts.routeHref);
      } else {
        setError(result.message);
      }
      setLoading(false);
      return result;
    },
    [url, enabled, opts?.routeHref]
  );

  useEffect(() => {
    if (!enabled || !url) return;
    void reload(true);
  }, [enabled, url, reload]);

  const mutateLocal = useCallback(
    (updater: T | ((prev: T | null) => T | null)) => {
      setData((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev) : updater;
        if (url && next != null) setPortalCache(url, next);
        return next;
      });
    },
    [url]
  );

  return {
    data,
    loading,
    error,
    reload,
    setData: mutateLocal,
    hasCache: Boolean(initial),
  };
}

export async function portalGet<T>(url: string): Promise<MutationResult<T>> {
  return cachedApiGet<T>(url);
}
