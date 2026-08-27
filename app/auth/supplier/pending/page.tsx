'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ShieldCheck, LogOut, ArrowRight, Archive } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { signOutTo } from '@/lib/client/sign-out';

function SupplierPendingContent() {
  const searchParams = useSearchParams();
  const [isArchived, setIsArchived] = useState(
    searchParams.get('status') === 'archived'
  );

  useEffect(() => {
    if (searchParams.get('status') === 'archived') {
      setIsArchived(true);
      return;
    }

    async function detectStatus() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (supplier?.status === 'archived') setIsArchived(true);
    }

    detectStatus();
  }, [searchParams]);

  function handleSignOut() {
    signOutTo('/auth?role=supplier&mode=signin');
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-md saas-panel p-8 text-center space-y-6">
        <div className="saas-icon-well-lg mx-auto">
          {isArchived ? <Archive className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>

        <div className="space-y-2">
          <span className={isArchived ? 'badge-warning' : 'badge-warning'}>
            {isArchived ? 'Account archived' : 'Pending approval'}
          </span>
          <h1 className="type-page text-xl sm:text-xl">
            {isArchived
              ? 'Supplier account is archived'
              : 'Supplier application under review'}
          </h1>
          <p className="type-subtitle max-w-sm mx-auto">
            {isArchived
              ? 'Your supplier account has been archived by an administrator. Account access is paused until the account is restored.'
              : 'Your email is confirmed. An admin still needs to approve your supplier application before you can access your supplier account.'}
          </p>
        </div>

        {!isArchived && (
          <div className="saas-inset-surface p-4 text-left space-y-2 text-xs">
            <div className="font-semibold text-portal-text flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Verification checklist
            </div>
            <ul className="list-disc list-inside space-y-1 text-portal-muted">
              <li>Corporate entity & tax compliance verification</li>
              <li>Manufacturing capacity & CNC tolerance audit</li>
              <li>ISO 9001 / AS9100 quality certifications</li>
            </ul>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/" className="saas-btn-primary gap-1.5">
            Return to public catalog
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button onClick={handleSignOut} className="saas-btn-secondary gap-1.5 text-portal-danger">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen saas-canvas-bg flex items-center justify-center text-xs font-mono text-portal-muted">
          Loading…
        </div>
      }
    >
      <SupplierPendingContent />
    </Suspense>
  );
}
