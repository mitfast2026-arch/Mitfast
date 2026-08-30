'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, LogIn, UserRound } from 'lucide-react';
import OverlayPortal, { OverlayBackdrop } from '@/components/ui/OverlayPortal';

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
  const loginHref = `/auth?role=buyer&mode=signin&intent=rfq&redirect=${encodeURIComponent(loginRedirect)}`;

  return (
    <OverlayPortal
      open={open}
      layer="modal"
      onEscape={onClose}
      className="flex items-center justify-center p-4 overflow-y-auto"
    >
      <OverlayBackdrop className="bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md p-6 sm:p-7 space-y-4 shadow-2xl bg-white border border-[#E2E4E8] rounded-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-lg font-bold text-[#111315]">Request a quote</h2>
        <p className="text-sm text-[#6B7280] leading-relaxed">
          Formal RFQs require a buyer account with name, email, and phone. Continue as guest to send
          an enquiry with your contact details — our team will follow up without losing your lead.
        </p>

        <div className="space-y-2.5 pt-1">
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-full bg-[#111315] text-white text-sm font-semibold hover:bg-[#1F2429] transition-colors shadow-sm"
            onClick={onClose}
          >
            <LogIn className="w-4 h-4" />
            Login / Register
          </Link>
          <Link
            href={guestEnquiryHref}
            className="w-full h-11 rounded-full border border-[#E2E4E8] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#F7F7F8] transition-colors text-[#111315]"
            onClick={onClose}
          >
            <UserRound className="w-4 h-4" />
            Continue as Guest
          </Link>
        </div>

        <p className="text-xs text-[#6B7280] flex items-start gap-1.5 pt-1">
          <Building2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#9CA3AF]" />
          Guests can always send product or general enquiries from the Enquiry page without signing in.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#6B7280] hover:text-[#111315] w-full text-center pt-1 font-medium transition-colors"
        >
          Keep shopping
        </button>
      </div>
    </OverlayPortal>
  );
}
