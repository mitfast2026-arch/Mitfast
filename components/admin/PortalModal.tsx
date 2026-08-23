'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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

export default function PortalModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
}: PortalModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`saas-panel w-full ${maxWidthClass[maxWidth]} flex flex-col max-h-[90vh] shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center justify-between px-5 py-4 border-b border-portal-border shrink-0">
            <h2 className="type-section">{title}</h2>
            <button type="button" onClick={onClose} className="saas-btn-ghost" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t border-portal-border shrink-0 flex justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
