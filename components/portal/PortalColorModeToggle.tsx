'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { usePortalColorMode } from '@/components/portal/PortalColorMode';

export default function PortalColorModeToggle() {
  const { mode, toggle, ready } = usePortalColorMode();
  const isLight = mode === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      className="saas-btn-ghost transition-transform duration-200 active:scale-95"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode (Soft Graphite)'}
      disabled={!ready}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Sun
          className={`absolute w-4 h-4 transition-all duration-300 ease-out ${
            isLight ? 'scale-75 opacity-0 rotate-90' : 'scale-100 opacity-100 rotate-0'
          }`}
        />
        <Moon
          className={`absolute w-4 h-4 transition-all duration-300 ease-out ${
            isLight ? 'scale-100 opacity-100 rotate-0' : 'scale-75 opacity-0 -rotate-90'
          }`}
        />
      </span>
    </button>
  );
}
