'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SupplierEnquiriesPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/supplier/orders');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <div className="saas-panel p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="type-page">Enquiries Workflow Managed by Admin</h1>
        <p className="type-subtitle max-w-lg mx-auto">
          Customer enquiries and negotiations are managed centrally by MITFAST Admin.
          Once finalized and accepted, confirmed purchase orders are sent directly to your Orders dashboard.
        </p>
        <div className="pt-4">
          <Link
            href="/supplier/orders"
            className="saas-btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Go to Supplier Orders</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-[11px] text-portal-muted pt-2 font-mono">
          Redirecting to Orders...
        </p>
      </div>
    </div>
  );
}
