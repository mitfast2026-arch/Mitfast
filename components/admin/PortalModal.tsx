'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import OverlayPortal, { OverlayBackdrop } from '@/components/ui/OverlayPortal';

type PortalModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
};

const maxWidthClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function PortalModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
}: PortalModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const auto = panel.querySelector<HTMLElement>(FOCUSABLE);
      if (auto) auto.focus();
      else panel.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  return (
    <OverlayPortal
      open={open}
      layer="modal"
      onEscape={onClose}
      className="flex items-center justify-center p-4 max-md:p-0"
    >
      <OverlayBackdrop className="bg-black/70" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative saas-panel w-full ${maxWidthClass[maxWidth]} flex flex-col max-h-[90dvh] max-md:h-dvh max-md:max-h-dvh max-md:rounded-none shadow-lg outline-none`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'portal-modal-title' : undefined}
        tabIndex={-1}
      >
        {title ? (
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-portal-border shrink-0">
            <h2 id="portal-modal-title" className="type-section text-sm sm:text-base">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="saas-btn-ghost p-2" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        <div className="px-4 sm:px-5 py-3 sm:py-4 overflow-y-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-portal-border shrink-0 flex flex-wrap flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </OverlayPortal>
  );
}
