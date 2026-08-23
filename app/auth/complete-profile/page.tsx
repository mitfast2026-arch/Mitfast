'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function CompleteProfilePage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [intendedRole, setIntendedRole] = useState<'customer' | 'supplier'>('customer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailLocked, setEmailLocked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.assign('/auth?mode=signin');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get('role');

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, email, role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        const effectiveRole =
          roleParam === 'supplier' || profile?.role === 'supplier' ? 'supplier' : 'customer';

        const nameOk = (profile?.full_name || '').trim().length >= 2;
        const phoneOk = (profile?.phone || '').trim().length >= 7;
        const emailOk = (profile?.email || user.email || '').trim().includes('@');

        if (nameOk && phoneOk && emailOk) {
          const redirectParam = params.get('redirect');
          const safeRedirect =
            redirectParam &&
            redirectParam.startsWith('/') &&
            !redirectParam.startsWith('//')
              ? redirectParam
              : null;

          if (effectiveRole === 'supplier') {
            const { data: sup } = await supabase
              .from('suppliers')
              .select('status')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!sup) window.location.assign('/auth/supplier/apply');
            else if (sup.status === 'active') window.location.assign('/supplier/dashboard');
            else if (sup.status === 'rejected') window.location.assign('/auth/supplier/rejected');
            else window.location.assign('/auth/supplier/pending');
            return;
          }

          try {
            await fetch('/api/guest/merge', { method: 'POST' });
          } catch {
            /* best-effort */
          }
          window.location.assign(safeRedirect || '/customer/dashboard');
          return;
        }

        const metaName =
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          '';
        setEmail((profile?.email || user.email || '').trim());
        setFullName((profile?.full_name || metaName || '').trim());
        setPhone((profile?.phone || '').trim());
        setEmailLocked(Boolean(user.email));
        setIntendedRole(effectiveRole);
      } catch {
        if (!cancelled) setErrorMsg('Could not load your account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          intendedRole,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Could not save profile');
        return;
      }

      if (json.data?.role === 'supplier') {
        window.location.assign('/auth/supplier/apply');
        return;
      }

      try {
        await fetch('/api/guest/merge', { method: 'POST' });
      } catch {
        /* best-effort */
      }

      const redirectParam = new URLSearchParams(window.location.search).get('redirect');
      const safeRedirect =
        redirectParam &&
        redirectParam.startsWith('/') &&
        !redirectParam.startsWith('//')
          ? redirectParam
          : '/customer/dashboard';
      window.location.assign(safeRedirect);
    } catch {
      setErrorMsg('Unexpected error saving profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen saas-canvas-bg flex items-center justify-center">
        <p className="type-subtitle">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-4 text-center">
        <Link href="/" className="inline-block">
          <span className="text-xl font-semibold text-[#111315] tracking-tight">MITFAST B2B</span>
        </Link>
        <h1 className="type-page text-2xl">Complete your profile</h1>
        <p className="type-subtitle">Name, phone, and email are required</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="saas-panel py-8 px-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="saas-label">Email *</label>
              <input
                type="email"
                required
                value={email}
                readOnly={emailLocked}
                onChange={(e) => setEmail(e.target.value)}
                className="saas-input"
              />
              {emailLocked && (
                <p className="text-[11px] text-[#6B7280]">Filled from your verified login</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="saas-label">Full name *</label>
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="saas-input"
                placeholder="e.g. Amit Patel"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Phone *</label>
              <input
                type="tel"
                required
                minLength={7}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="saas-input"
                placeholder="+91 98765 43210"
              />
            </div>

            <button type="submit" disabled={saving} className="saas-btn-primary w-full py-2.5 gap-2">
              <span>{saving ? 'Saving…' : 'Continue'}</span>
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-[11px] text-[#6B7280] flex items-center gap-1 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {intendedRole === 'supplier'
              ? 'Next: company details for admin approval'
              : 'You can add delivery addresses later'}
          </p>
        </div>
      </div>
    </div>
  );
}
