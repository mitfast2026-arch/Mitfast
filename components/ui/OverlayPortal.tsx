'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/lib/client/use-body-scroll-lock';

export type OverlayLayer = 'drawer' | 'modal' | 'popover';

const LAYER_Z: Record<OverlayLayer, string> = {
  drawer: 'z-drawer',
  modal: 'z-modal',
  popover: 'z-popover',
};

type OverlayPortalProps = {
  open: boolean;
  layer: OverlayLayer;
  children: React.ReactNode;
  onEscape?: () => void;
  lockScroll?: boolean;
  /** Extra classes on the viewport-filling root (drawer/modal only). */
  className?: string;
};

/**
 * Renders overlay content on document.body so it is not trapped by isolate /
 * backdrop-filter / overflow ancestors. Drawer and modal roots cover the
 * viewport at the shared layer token; popovers are portaled as-is.
 */
export default function OverlayPortal({
  open,
  layer,
  children,
  onEscape,
  lockScroll,
  className,
}: OverlayPortalProps) {
  const [mounted, setMounted] = useState(false);
  const shouldLock = lockScroll ?? layer !== 'popover';

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(open && shouldLock);

  useEffect(() => {
    if (!open || !onEscape) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      onEscape?.();
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onEscape]);

  if (!open || !mounted) return null;

  const node =
    layer === 'popover' ? (
      children
    ) : (
      <div className={`fixed inset-0 ${LAYER_Z[layer]} animate-in fade-in duration-200${className ? ` ${className}` : ''}`}>
        {children}
      </div>
    );

  return createPortal(node, document.body);
}

type OverlayBackdropProps = {
  onClick?: () => void;
  className?: string;
};

/** Full-viewport dimmer. Place as the first child inside OverlayPortal. */
export function OverlayBackdrop({ onClick, className = 'bg-black/40' }: OverlayBackdropProps) {
  return (
    <div
      className={`absolute inset-0 ${className}`}
      aria-hidden="true"
      onClick={onClick}
    />
  );
}
