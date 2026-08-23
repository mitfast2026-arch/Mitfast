'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, LogIn, UserRound } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Where to return after login (e.g. /cart or /cart?submit=1) */
  loginRedirect: string;
  /** Guest enquiry path, usually /enquiry?type=cart */
  guestEnquiryHref?: string;
};

export default function AuthOrGuestGate({
  open,
  onClose,
  loginRedirect,
  guestEnquiryHref = '/enquiry?type=cart',
}: Props) {
  if (!open) return null;

  const loginHref = `/auth?role=buyer&mode=signin&intent=rfq&redirect=${encodeURIComponent(loginRedirect)}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative saas-panel w-full max-w-md p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold text-[color:var(--portal-text)]">Request a quote</h2>
        <p className="text-sm text-[color:var(--portal-muted)] leading-relaxed">
          Formal RFQs require a buyer account. Continue as guest to send an enquiry with your selected
          products — our team will follow up without losing your lead.
        </p>

        <div className="space-y-2.5 pt-1">
          <Link
            href={loginHref}
            className="saas-btn-primary w-full py-2.5 gap-2 inline-flex items-center justify-center"
            onClick={onClose}
          >
            <LogIn className="w-4 h-4" />
            Login / Register
          </Link>
          <Link
            href={guestEnquiryHref}
            className="w-full py-2.5 rounded-2xl border border-[color:var(--portal-border)] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[color:var(--portal-hover)] transition-colors"
            onClick={onClose}
          >
            <UserRound className="w-4 h-4" />
            Continue as Guest
          </Link>
        </div>

        <p className="text-[11px] text-[color:var(--portal-muted)] flex items-start gap-1.5 pt-1">
          <Building2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Guests can always send product or general enquiries from the Enquiry page without signing in.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[color:var(--portal-muted)] hover:text-[color:var(--portal-text)] w-full text-center pt-1"
        >
          Keep shopping
        </button>
      </div>
    </div>
  );
}
