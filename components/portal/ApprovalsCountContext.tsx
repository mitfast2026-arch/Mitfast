'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiGet } from '@/lib/client/api-client';

interface ApprovalsCountContextValue {
  pendingApprovalsCount: number;
  refreshApprovalsCount: () => Promise<void>;
}

const ApprovalsCountContext = createContext<ApprovalsCountContextValue | null>(null);

const APPROVALS_CHANGED_EVENT = 'mitfast:approvals-changed';
const DASHBOARD_CHANGED_EVENT = 'mitfast:dashboard-changed';

export function notifyApprovalsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPROVALS_CHANGED_EVENT));
    // Approvals/publish/reject also change Operations KPIs
    window.dispatchEvent(new CustomEvent(DASHBOARD_CHANGED_EVENT));
  }
}

export function notifyDashboardChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DASHBOARD_CHANGED_EVENT));
  }
}

export function onDashboardChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DASHBOARD_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DASHBOARD_CHANGED_EVENT, handler);
}

export function ApprovalsCountProvider({ children }: { children: React.ReactNode }) {
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const refreshApprovalsCount = useCallback(async () => {
    try {
      const result = await apiGet<{ total: number }>('/api/admin/approvals/count');
      if (result.ok) {
        setPendingApprovalsCount(result.data.total ?? 0);
      }
    } catch {
      // silent — badge is non-critical
    }
  }, []);

  useEffect(() => {
    refreshApprovalsCount();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshApprovalsCount();
    }, 180_000);
    const onChanged = () => refreshApprovalsCount();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshApprovalsCount();
    };
    window.addEventListener(APPROVALS_CHANGED_EVENT, onChanged);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener(APPROVALS_CHANGED_EVENT, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshApprovalsCount]);

  return (
    <ApprovalsCountContext.Provider value={{ pendingApprovalsCount, refreshApprovalsCount }}>
      {children}
    </ApprovalsCountContext.Provider>
  );
}

export function useApprovalsCount() {
  const ctx = useContext(ApprovalsCountContext);
  if (!ctx) {
    throw new Error('useApprovalsCount must be used within ApprovalsCountProvider');
  }
  return ctx;
}
