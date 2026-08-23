'use client';

import React from 'react';
import { Toaster } from 'sonner';

export function PortalToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        style: {
          background: '#171717',
          border: '1px solid #262626',
          color: '#F5F5F5',
        },
      }}
    />
  );
}
