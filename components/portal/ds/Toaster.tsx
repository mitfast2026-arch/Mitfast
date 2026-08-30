'use client';

import React from 'react';
import { Toaster } from 'sonner';
import { usePortalColorMode } from '@/components/portal/PortalColorMode';

export function PortalToaster() {
  const { mode } = usePortalColorMode();
  const isLight = mode === 'light';

  return (
    <Toaster
      theme={isLight ? 'light' : 'dark'}
      position="top-right"
      className="z-toast"
      style={{ zIndex: 'var(--z-toast)' }}
      toastOptions={{
        style: {
          background: 'var(--portal-panel)',
          border: '1px solid var(--portal-border)',
          color: 'var(--portal-text)',
        },
      }}
    />
  );
}
