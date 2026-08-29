'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type ProductFormSectionProps = {
  id: string;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function ProductFormSection({
  id,
  title,
  badge,
  defaultOpen = true,
  children,
}: ProductFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="scroll-mt-3 border border-portal-border rounded-lg overflow-hidden bg-portal-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-portal-inset hover:bg-portal-hover transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-portal-text uppercase tracking-wide">{title}</span>
          {badge && (
            <span className="saas-badge-neutral text-[10px] py-0 px-1.5">{badge}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-portal-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </section>
  );
}

export function FormField({
  label,
  required,
  optional,
  error,
  fieldKey,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  /** Maps to data-field for validation scroll/focus */
  fieldKey?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-field={fieldKey}>
      <label className="saas-label flex items-center gap-1">
        {label}
        {required && <span className="text-portal-danger">*</span>}
        {optional && <span className="text-portal-muted font-normal normal-case">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-portal-danger mt-1">{error}</p>}
    </div>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
