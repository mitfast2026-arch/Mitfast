'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { flushSync } from 'react-dom';

export type PortalColorMode = 'dark' | 'light';

export const PORTAL_COLOR_MODE_KEY = 'mitfast-portal-color-mode';
const LIGHT_CLASS = 'portal-theme-light';
const ANIM_CLASS = 'portal-theme-animating';
const ANIM_MS = 320;

type PortalColorModeContextValue = {
  mode: PortalColorMode;
  animating: boolean;
  ready: boolean;
  setMode: (mode: PortalColorMode) => void;
  toggle: () => void;
};

const PortalColorModeContext = createContext<PortalColorModeContextValue | null>(null);

function readStoredMode(): PortalColorMode {
  try {
    if (typeof document !== 'undefined') {
      const fromHtml = document.documentElement.dataset.portalTheme;
      if (fromHtml === 'light' || fromHtml === 'dark') return fromHtml;
    }
    return localStorage.getItem(PORTAL_COLOR_MODE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function writeHtmlTheme(mode: PortalColorMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.portalTheme = mode;
}

export function PortalColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<PortalColorMode>('dark');
  const [animating, setAnimating] = useState(false);
  const [ready, setReady] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const next = readStoredMode();
    setModeState(next);
    writeHtmlTheme(next);
    setReady(true);
  }, []);

  const setMode = useCallback((next: PortalColorMode) => {
    try {
      localStorage.setItem(PORTAL_COLOR_MODE_KEY, next);
    } catch {
      // ignore quota / private mode
    }

    const commit = () => {
      writeHtmlTheme(next);
      setModeState(next);
    };

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };

    if (typeof doc.startViewTransition === 'function') {
      try {
        const transition = doc.startViewTransition(() => {
          flushSync(commit);
        });
        void transition.finished.catch(() => undefined);
        startTransition(() => undefined);
        return;
      } catch {
        // fall through to CSS transition
      }
    }

    setAnimating(true);
    flushSync(commit);
    window.setTimeout(() => setAnimating(false), ANIM_MS);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, animating, ready, setMode, toggle }),
    [mode, animating, ready, setMode, toggle]
  );

  return (
    <PortalColorModeContext.Provider value={value}>{children}</PortalColorModeContext.Provider>
  );
}

/** Portal shell root — keeps theme classes in React so they aren't wiped mid-transition. */
export function PortalUiRoot({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { mode, animating } = usePortalColorMode();
  const classes = [
    className,
    mode === 'light' ? LIGHT_CLASS : '',
    animating ? ANIM_CLASS : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} suppressHydrationWarning>
      {children}
    </div>
  );
}

export function usePortalColorMode() {
  const ctx = useContext(PortalColorModeContext);
  if (!ctx) {
    return {
      mode: 'dark' as PortalColorMode,
      animating: false,
      ready: false,
      setMode: (_mode: PortalColorMode) => {},
      toggle: () => {},
    };
  }
  return ctx;
}
