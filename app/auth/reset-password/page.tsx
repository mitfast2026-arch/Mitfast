'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { homeForRole } from '@/lib/auth/post-auth-path';
import '@/app/auth/auth.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (user) {
          setHasSession(true);
        } else {
          setHasSession(false);
        }
      } catch (err: unknown) {
        if (!cancelled) setHasSession(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setSuccessMsg('Your password has been successfully updated.');
      
      // Fetch user profile to redirect to appropriate dashboard
      const { data: { user } } = await supabase.auth.getUser();
      let target = '/customer/dashboard';
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.role === 'supplier') {
          const { data: sup } = await supabase
            .from('suppliers')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle();
          target = homeForRole('supplier', sup?.status ?? null);
        } else {
          target = homeForRole(profile?.role);
        }
      }

      setTimeout(() => {
        router.push(target);
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password. Please try again.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/auth?mode=signin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-portal-muted hover:text-portal-fg transition-colors px-3 py-1.5 rounded-full border border-portal-border bg-portal-panel shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-portal-fg">MITFAST</span>
          </Link>
          <div className="w-20" />
        </div>
        <div className="auth-brand">
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter and confirm your new secure password below.
          </p>
        </div>

        <div className="auth-card">
          {loading ? (
            <div className="py-8 text-center text-sm text-portal-muted">
              Verifying security session…
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-portal-danger-soft text-portal-danger text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Reset session expired or invalid</p>
                  <p className="mt-1">
                    Your password reset link is invalid or has expired. Please request a new link.
                  </p>
                </div>
              </div>
              <Link
                href="/auth?mode=forgot"
                className="saas-btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-center"
              >
                <span>Request new reset link</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-portal-danger-soft text-portal-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-portal-success-soft text-portal-success text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="saas-label" htmlFor="reset-new-password">
                  New password
                </label>
                <div className="auth-field-icon">
                  <Lock />
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="saas-input pr-10"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="saas-label" htmlFor="reset-confirm-password">
                  Confirm new password
                </label>
                <div className="auth-field-icon">
                  <Lock />
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="saas-input pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || password.length < 6 || confirmPassword.length < 6}
                className="saas-btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{saving ? 'Updating password…' : 'Save new password'}</span>
              </button>

              <div className="text-center pt-2">
                <Link href="/auth?mode=signin" className="text-xs text-portal-muted hover:text-portal-fg">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
