'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function SalesWorkflowBar({ active }: { active: 'enquiries' | 'rfqs' | 'orders' }) {
  const steps = [
    { key: 'enquiries' as const, label: 'Enquiries', href: '/admin/enquiries' },
    { key: 'rfqs' as const, label: 'RFQs', href: '/admin/rfqs' },
    { key: 'orders' as const, label: 'Orders', href: '/admin/orders' },
  ];

  return (
    <div className="saas-panel px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="type-meta text-portal-muted mr-1">Workflow</span>
      {steps.map((step, i) => (
        <span key={step.key} className="flex items-center gap-2">
          {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-portal-subtle" />}
          <Link
            href={step.href}
            className={
              active === step.key
                ? 'font-semibold text-portal-accent'
                : 'text-portal-muted hover:text-portal-text'
            }
          >
            {step.label}
          </Link>
        </span>
      ))}
      <span className="hidden sm:inline text-portal-subtle text-xs ml-auto">
        Enquiry → RFQ / negotiation → accepted → order
      </span>
    </div>
  );
}

export function ContactGrid({
  name,
  email,
  phone,
  country,
  company,
}: {
  name: string;
  email: string;
  phone: string;
  country: string;
  company?: string | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-portal-inset p-4 rounded-lg border border-portal-border text-sm">
      <div>
        <span className="type-meta text-portal-muted">Name</span>
        <div className="font-medium text-portal-text mt-0.5">{name}</div>
      </div>
      {company && (
        <div>
          <span className="type-meta text-portal-muted">Company</span>
          <div className="text-portal-text mt-0.5">{company}</div>
        </div>
      )}
      <div>
        <span className="type-meta text-portal-muted">Email</span>
        <div className="text-portal-text truncate mt-0.5">{email}</div>
      </div>
      <div>
        <span className="type-meta text-portal-muted">Phone</span>
        <div className="text-portal-text mt-0.5">{phone}</div>
      </div>
      <div>
        <span className="type-meta text-portal-muted">Country</span>
        <div className="text-portal-text mt-0.5">{country}</div>
      </div>
    </div>
  );
}
