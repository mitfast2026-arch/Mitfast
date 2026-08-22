'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiGet } from '@/lib/client/api-client';

interface ApprovalsCountContextValue {
  pendingApprovalsCount: number;
  refreshApprovalsCount: () => Promise<void>;
}

const ApprovalsCountContext = createContext<ApprovalsCountContextValue | null>(null);

const APPROVALS_CHANGED_EVENT = 'mitfast:approvals-changed';

export function notifyApprovalsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPROVALS_CHANGED_EVENT));
  }
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
    const interval = setInterval(refreshApprovalsCount, 60_000);
    const onChanged = () => refreshApprovalsCount();
    window.addEventListener(APPROVALS_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener(APPROVALS_CHANGED_EVENT, onChanged);
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
