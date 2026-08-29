'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShoppingCart,
  Building2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase/client';
import { getSettings } from '@/lib/client/settings-cache';
import { mergeGuestStateOnce } from '@/lib/client/guest-merge';
import './auth.css';

export type AuthSearchParams = {
  role?: string;
  mode?: string;
  redirect?: string;
  error?: string;
  intent?: string;
  guestEnquiry?: string;
};

type RegisterStep = 'email' | 'password' | 'otp';
type AuthMode = 'signin' | 'register' | 'forgot';

const REGISTER_STEPS: { id: RegisterStep; label: string }[] = [
  { id: 'email', label: 'Account' },
  { id: 'password', label: 'Password' },
  { id: 'otp', label: 'Verify' },
];

const OTP_RESEND_COOLDOWN_SEC = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_VERIFY_LOCKOUT_SEC = 60;

function formatWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins <= 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs}s`;
}

function redirectHard(path: string) {
  window.location.assign(path);
}

function buildAuthHref(
  mode: AuthMode,
  role: 'buyer' | 'supplier',
  redirectPath?: string,
  extras?: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  params.set('role', role);
  params.set('mode', mode === 'forgot' ? 'forgot' : mode);
  if (redirectPath) params.set('redirect', redirectPath);
  if (extras?.intent) params.set('intent', extras.intent);
  if (extras?.guestEnquiry) params.set('guestEnquiry', extras.guestEnquiry);
  return `/auth?${params.toString()}`;
}

async function resolvePostAuthPath(
  supabase: ReturnType<typeof createBrowserClient>,
  userId: string,
  opts: {
    isAdminAuth: boolean;
    preferredRole: 'buyer' | 'supplier';
    redirectPath?: string;
  }
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone, email')
    .eq('user_id', userId)
    .maybeSingle();

  const nameOk = (profile?.full_name || '').trim().length >= 2;
  const phoneOk = (profile?.phone || '').trim().length >= 7;
  const emailOk = (profile?.email || '').trim().includes('@');
  const identityOk = nameOk && phoneOk && emailOk;

  if (opts.isAdminAuth) {
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('This account does not have admin access.');
    }
    return opts.redirectPath?.startsWith('/admin')
      ? opts.redirectPath
      : '/admin/dashboard';
  }

  if (profile?.role === 'admin') {
    return '/admin/dashboard';
  }

  const wantsSupplier = opts.preferredRole === 'supplier' || profile?.role === 'supplier';

  if (wantsSupplier) {
    if (profile?.role === 'customer') {
      throw new Error('This account is already a buyer. Use a different email for supplier access.');
    }

    const { data: sup } = await supabase
      .from('suppliers')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!sup) return '/auth/supplier/apply';
    if (sup.status === 'rejected') return '/auth/supplier/rejected';
    if (sup.status === 'pending' || sup.status === 'archived') {
      return sup.status === 'archived'
        ? '/auth/supplier/pending?status=archived'
        : '/auth/supplier/pending';
    }
    if (opts.redirectPath?.startsWith('/supplier')) return opts.redirectPath;
    return '/supplier/dashboard';
  }

  if (!identityOk) {
    return `/auth/complete-profile?role=buyer`;
  }

  if (
    opts.redirectPath &&
    (opts.redirectPath.startsWith('/cart') ||
      opts.redirectPath.startsWith('/customer') ||
      opts.redirectPath.startsWith('/products') ||
      opts.redirectPath.startsWith('/rfq'))
  ) {
    return opts.redirectPath;
  }

  return '/customer/dashboard';
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function RegisterStepper({ current }: { current: RegisterStep }) {
  const currentIdx = REGISTER_STEPS.findIndex((s) => s.id === current);

  return (
    <div className="auth-stepper" aria-label="Registration progress">
      {REGISTER_STEPS.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = idx < currentIdx;
        return (
          <div
            key={step.id}
            className={`auth-stepper__item${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
          >
            <span className="auth-stepper__dot" aria-hidden="true">
              {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : idx + 1}
            </span>
            <span className="auth-stepper__label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmailChip({ email, onEdit }: { email: string; onEdit: () => void }) {
  return (
    <div className="auth-email-chip">
      <Mail className="auth-email-chip__icon w-4 h-4" />
      <span className="auth-email-chip__text">{email}</span>
      <button type="button" className="auth-email-chip__edit" onClick={onEdit}>
        Change
      </button>
    </div>
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  function focusCell(index: number) {
    inputsRef.current[index]?.focus();
  }

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? digit : d.trim())).join('').slice(0, 6);
    onChange(next);
    if (digit && index < 5) focusCell(index + 1);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      focusCell(index - 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted);
    focusCell(Math.min(pasted.length, 5));
  }

  return (
    <div className="auth-otp-row" onPaste={handlePaste}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit.trim()}
          disabled={disabled}
          className="auth-otp-cell"
          aria-label={`Digit ${idx + 1}`}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export default function AuthPageClient({ searchParams }: { searchParams: AuthSearchParams }) {
  const router = useRouter();
  const roleParam = searchParams.role;
  const initialRole = (roleParam === 'supplier' ? 'supplier' : 'buyer') as 'buyer' | 'supplier';
  const isAdminAuth = roleParam === 'admin';
  const redirectPath = searchParams.redirect;
  const showGuestContinue =
    !isAdminAuth &&
    (searchParams.intent === 'rfq' ||
      searchParams.guestEnquiry === '1' ||
      (redirectPath || '').includes('/cart') ||
      (redirectPath || '').includes('/rfq'));

  const [activeRole, setActiveRole] = useState<'buyer' | 'supplier'>(initialRole);
  const [authMode, setAuthMode] = useState<AuthMode>(
    searchParams.mode === 'register'
      ? 'register'
      : searchParams.mode === 'forgot'
        ? 'forgot'
        : 'signin'
  );
  const [registerStep, setRegisterStep] = useState<RegisterStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [otpFailCount, setOtpFailCount] = useState(0);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const r = searchParams.role;
    if (r === 'buyer' || r === 'supplier') setActiveRole(r);
    setAuthMode(
      searchParams.mode === 'register'
        ? 'register'
        : searchParams.mode === 'forgot'
          ? 'forgot'
          : 'signin'
    );
    const err = searchParams.error;
    if (err && err !== 'missing_code') {
      setErrorMsg(decodeURIComponent(err));
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    // Use shared settings-cache
    getSettings().then((s) => {
      if (!cancelled && typeof s?.googleLoginEnabled === 'boolean') {
        setGoogleEnabled(s.googleLoginEnabled);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  function resetFlowState() {
    setRegisterStep('email');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpFailCount(0);
    setErrorMsg('');
    setSuccessMsg('');
  }

  function switchAuthMode(mode: AuthMode) {
    resetFlowState();
    setAuthMode(mode);
    router.replace(
      buildAuthHref(mode, activeRole, redirectPath, {
        intent: searchParams.intent,
        guestEnquiry: searchParams.guestEnquiry,
      }),
      { scroll: false }
    );
  }

  function switchRole(role: 'buyer' | 'supplier') {
    setActiveRole(role);
    resetFlowState();
    router.replace(
      buildAuthHref(authMode, role, redirectPath, {
        intent: searchParams.intent,
        guestEnquiry: searchParams.guestEnquiry,
      }),
      { scroll: false }
    );
  }

  async function handleGoogle() {
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setLoading(true);
    submitLockRef.current = true;
    try {
      const supabase = createBrowserClient();
      const origin = window.location.origin;
      // Supplier Google onboarding intent via next= only — never authorize from metadata alone
      const defaultNext =
        activeRole === 'supplier'
          ? '/auth/supplier/apply'
          : '/customer/dashboard';
      let nextTarget = defaultNext;
      if (redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('//')) {
        if (activeRole === 'supplier') {
          // Keep supplier onboarding intent even when a deep-link redirect is present
          nextTarget = redirectPath.includes('role=supplier') || redirectPath.startsWith('/supplier')
            ? redirectPath
            : `/auth/supplier/apply?redirect=${encodeURIComponent(redirectPath)}`;
        } else {
          nextTarget = redirectPath;
        }
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed');
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function deliverOtp() {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        role: activeRole === 'supplier' ? 'supplier' : 'customer',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const retryAfter = Number(json?.error?.retryAfterSeconds);
      if (res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
        setCooldown(retryAfter);
        setRegisterStep('otp');
      }
      throw new Error(json?.error?.message || 'Could not send verification code');
    }
    setRegisterStep('otp');
    setCooldown(OTP_RESEND_COOLDOWN_SEC);
    setOtpFailCount(0);
    setSuccessMsg('Verification code sent. Check your inbox (and spam).');
  }

  async function sendOtp() {
    if (submitLockRef.current || loading || cooldown > 0) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    submitLockRef.current = true;
    try {
      await deliverOtp();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Email is required');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    submitLockRef.current = true;
    toast.loading('Signing in...', { id: 'auth-toast' });
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
          throw new Error('Invalid email or password.');
        }
        if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
          setAuthMode('register');
          setRegisterStep('otp');
          try {
            await deliverOtp();
            toast.info('Verify your email to continue signing in.', { id: 'auth-toast' });
            setSuccessMsg('Verify your email to continue signing in.');
          } catch (otpErr: unknown) {
            const otpMsg =
              otpErr instanceof Error ? otpErr.message : 'Could not send verification code';
            setErrorMsg(otpMsg);
            toast.error(otpMsg, { id: 'auth-toast' });
          }
          return;
        }
        throw error;
      }

      if (!data.user) throw new Error('Sign in failed');

      if (!data.session) {
        setAuthMode('register');
        setRegisterStep('otp');
        try {
          await deliverOtp();
          toast.info('Enter verification code sent to your email.', { id: 'auth-toast' });
        } catch (otpErr: unknown) {
          const otpMsg =
            otpErr instanceof Error ? otpErr.message : 'Could not send verification code';
          setErrorMsg(otpMsg);
          toast.error(otpMsg, { id: 'auth-toast' });
        }
        return;
      }

      toast.success('Signed in successfully! Redirecting...', { id: 'auth-toast' });

      try {
        await mergeGuestStateOnce();
      } catch {
        /* best-effort */
      }

      const target = await resolvePostAuthPath(supabase, data.user.id, {
        isAdminAuth: false,
        preferredRole: activeRole,
        redirectPath,
      });
      redirectHard(target);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not sign in';
      setErrorMsg(msg);
      toast.error(msg, { id: 'auth-toast' });
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function handleRegisterEmail(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Enter a valid work email address');
      return;
    }
    setRegisterStep('password');
  }

  async function handleRegisterPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    submitLockRef.current = true;
    toast.loading('Creating account...', { id: 'auth-toast' });
    try {
      const supabase = createBrowserClient();
      const role = activeRole === 'supplier' ? 'supplier' : 'customer';
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role } },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          throw new Error('This email is already registered. Sign in instead.');
        }
        throw error;
      }

      // Supabase may return a user without identities when email already exists (no error)
      const identities = (data.user as { identities?: unknown[] } | null)?.identities;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        throw new Error('This email is already registered. Sign in instead.');
      }

      if (!data.user) throw new Error('Registration failed. Please try again.');

      await deliverOtp();
      toast.success('Verification code sent to your email!', { id: 'auth-toast' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create account';
      setErrorMsg(msg);
      toast.error(msg, { id: 'auth-toast' });
      if (msg.toLowerCase().includes('already registered')) {
        // Stay on password step; user can switch to Sign in via footer / mode tabs
      }
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (otp.length < 6) {
      setErrorMsg('Enter the 6-digit verification code');
      return;
    }

    if (otpFailCount >= OTP_MAX_VERIFY_ATTEMPTS && cooldown > 0) {
      setErrorMsg(`Too many incorrect codes. Wait ${formatWait(cooldown)} before trying again.`);
      return;
    }

    setLoading(true);
    submitLockRef.current = true;
    toast.loading('Verifying code...', { id: 'auth-toast' });
    try {
      const supabase = createBrowserClient();
      const token = otp.trim();
      let result = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      });

      if (result.error || !result.data.user) {
        result = await supabase.auth.verifyOtp({
          email: email.trim(),
          token,
          type: 'magiclink',
        });
      }

      if (result.error) throw result.error;
      if (!result.data.user) throw new Error('Verification failed');

      setOtpFailCount(0);
      toast.success('Verified! Redirecting…', { id: 'auth-toast' });

      try {
        await mergeGuestStateOnce();
      } catch {
        /* best-effort */
      }

      const target = await resolvePostAuthPath(supabase, result.data.user.id, {
        isAdminAuth: false,
        preferredRole: activeRole,
        redirectPath,
      });
      redirectHard(target);
    } catch (err: unknown) {
      const nextFails = otpFailCount + 1;
      setOtpFailCount(nextFails);
      setOtp('');
      if (nextFails >= OTP_MAX_VERIFY_ATTEMPTS) {
        setCooldown(Math.max(cooldown, OTP_VERIFY_LOCKOUT_SEC));
        const msg = `Too many incorrect codes. Wait ${formatWait(OTP_VERIFY_LOCKOUT_SEC)} before trying again.`;
        setErrorMsg(msg);
        toast.error(msg, { id: 'auth-toast' });
      } else {
        const remaining = OTP_MAX_VERIFY_ATTEMPTS - nextFails;
        const msg =
          err instanceof Error
            ? `${err.message} (${remaining} attempt${remaining === 1 ? '' : 's'} left)`
            : `Invalid or expired code (${remaining} attempts left)`;
        setErrorMsg(msg);
        toast.error(msg, { id: 'auth-toast' });
      }
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg('Enter a valid email address');
      return;
    }
    setLoading(true);
    submitLockRef.current = true;
    try {
      const supabase = createBrowserClient();
      const origin = window.location.origin;
      // Generic response either way — avoid account enumeration
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`,
      });
      if (error) {
        console.error('[forgot-password]', error.message);
      }
      setSuccessMsg(
        'If an account exists for that email, a password reset link has been sent. Check inbox and spam.'
      );
      setCooldown(OTP_RESEND_COOLDOWN_SEC);
    } catch {
      setSuccessMsg(
        'If an account exists for that email, a password reset link has been sent. Check inbox and spam.'
      );
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  async function handleAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    submitLockRef.current = true;
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error('Invalid email or password');
      if (!data.user) throw new Error('Sign in failed');
      const target = await resolvePostAuthPath(supabase, data.user.id, {
        isAdminAuth: true,
        preferredRole: 'buyer',
        redirectPath,
      });
      redirectHard(target);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid email or password');
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  const heading = isAdminAuth
    ? { title: 'Staff sign in', subtitle: 'Admin dashboard access' }
    : authMode === 'forgot'
      ? {
          title: 'Reset password',
          subtitle: 'We will email a secure link to set a new password',
        }
      : authMode === 'signin'
        ? {
            title: 'Sign in',
            subtitle:
              activeRole === 'buyer'
                ? 'Sign in to your buyer account'
                : 'Sign in to your supplier account',
          }
        : registerStep === 'otp'
          ? { title: 'Verify your email', subtitle: `Enter the code sent to ${email}` }
          : registerStep === 'password'
            ? { title: 'Create a password', subtitle: 'Use at least 6 characters for your account' }
            : {
                title: 'Create account',
                subtitle:
                  activeRole === 'buyer'
                    ? 'Register as a buyer on MITFAST B2B'
                    : 'Register as a supplier — admin approval required',
              };

  return (
    <div className="auth-page saas-canvas-bg">
      <div className="auth-card">
        <Link href="/" className="auth-brand">
          MITFAST B2B
        </Link>

        {!isAdminAuth && (authMode === 'forgot' || registerStep === 'email') && (
          <>
            <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signin'}
                className={`auth-mode-tab${authMode === 'signin' ? ' is-active' : ''}`}
                onClick={() => switchAuthMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'register'}
                className={`auth-mode-tab${authMode === 'register' ? ' is-active' : ''}`}
                onClick={() => switchAuthMode('register')}
              >
                Create account
              </button>
            </div>

            <div className="auth-role-tabs" role="tablist" aria-label="Account type">
              <button
                type="button"
                role="tab"
                aria-selected={activeRole === 'buyer'}
                className={`auth-role-tab${activeRole === 'buyer' ? ' is-active' : ''}`}
                onClick={() => switchRole('buyer')}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Buyer
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeRole === 'supplier'}
                className={`auth-role-tab${activeRole === 'supplier' ? ' is-active' : ''}`}
                onClick={() => switchRole('supplier')}
              >
                <Building2 className="w-3.5 h-3.5" />
                Supplier
              </button>
            </div>
          </>
        )}

        <div className="auth-heading">
          <h1>{heading.title}</h1>
          <p>{heading.subtitle}</p>
        </div>

        {authMode === 'register' && !isAdminAuth && (
          <RegisterStepper current={registerStep} />
        )}

        {errorMsg && (
          <div className="auth-alert auth-alert--error" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert--success" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {isAdminAuth ? (
          <form onSubmit={handleAdminPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="saas-label" htmlFor="admin-email">
                Work email
              </label>
              <div className="auth-field-icon">
                <Mail />
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="saas-input"
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="saas-label" htmlFor="admin-password">
                Password
              </label>
              <div className="auth-field-icon">
                <Lock />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="saas-input pr-10"
                  autoComplete="current-password"
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
            <button type="submit" disabled={loading} className="saas-btn-primary w-full py-2.5">
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : authMode === 'forgot' ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="saas-label" htmlFor="forgot-email">
                Work email
              </label>
              <div className="auth-field-icon">
                <Mail />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="saas-input"
                  autoComplete="email"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || cooldown > 0 || !email.trim()}
              className="saas-btn-primary w-full py-2.5"
            >
              {loading
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend available in ${formatWait(cooldown)}`
                  : 'Send reset link'}
              {!loading && cooldown <= 0 && <ArrowRight className="w-4 h-4" />}
            </button>
            <div className="auth-back-row">
              <button type="button" onClick={() => switchAuthMode('signin')}>
                ← Back to sign in
              </button>
            </div>
          </form>
        ) : authMode === 'signin' ? (
          <div className="space-y-4">
            {googleEnabled && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogle}
                  className="auth-google-btn"
                >
                  <GoogleGlyph />
                  {activeRole === 'supplier'
                    ? 'Continue with Google as supplier'
                    : 'Continue with Google'}
                </button>
                <div className="auth-divider">
                  <span>or</span>
                </div>
              </>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="saas-label" htmlFor="signin-email">
                  Work email
                </label>
                <div className="auth-field-icon">
                  <Mail />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="saas-input"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="saas-label" htmlFor="signin-password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-[11px] text-[#6B7280] hover:text-[#111315]"
                    onClick={() => switchAuthMode('forgot')}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-field-icon">
                  <Lock />
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="saas-input pr-10"
                    autoComplete="current-password"
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
              <button
                type="submit"
                disabled={loading || password.length < 6}
                className="saas-btn-primary w-full py-2.5"
              >
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
            {activeRole === 'supplier' && (
              <p className="auth-hint">
                New suppliers: Google or email signup still requires company application and admin
                approval before portal access.
              </p>
            )}
          </div>
        ) : registerStep === 'email' ? (
          <div className="space-y-4">
            {googleEnabled && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogle}
                  className="auth-google-btn"
                >
                  <GoogleGlyph />
                  Continue with Google
                </button>
                <div className="auth-divider">
                  <span>or</span>
                </div>
              </>
            )}

            <form onSubmit={handleRegisterEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="saas-label" htmlFor="register-email">
                  Work email
                </label>
                <div className="auth-field-icon">
                  <Mail />
                  <input
                    id="register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="saas-input"
                    autoComplete="email"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                className="saas-btn-primary w-full py-2.5"
              >
                Continue
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
              {activeRole === 'supplier' && (
                <p className="auth-hint">
                  Suppliers complete a company profile after verification. Portal access starts after
                  admin approval.
                </p>
              )}
            </form>
          </div>
        ) : registerStep === 'password' ? (
          <form onSubmit={handleRegisterPassword} className="space-y-4">
            <EmailChip
              email={email}
              onEdit={() => {
                setRegisterStep('email');
                setPassword('');
                setConfirmPassword('');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            />
            <div className="space-y-1.5">
              <label className="saas-label" htmlFor="register-password">
                Password
              </label>
              <div className="auth-field-icon">
                <Lock />
                <input
                  id="register-password"
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
              <label className="saas-label" htmlFor="register-confirm">
                Confirm password
              </label>
              <div className="auth-field-icon">
                <Lock />
                <input
                  id="register-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="saas-input"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || password.length < 6 || confirmPassword.length < 6}
              className="saas-btn-primary w-full py-2.5"
            >
              {loading ? 'Creating account…' : 'Create account & verify'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <div className="auth-back-row">
              <button
                type="button"
                onClick={() => {
                  setRegisterStep('email');
                  setPassword('');
                  setConfirmPassword('');
                  setErrorMsg('');
                }}
              >
                ← Back
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <EmailChip
              email={email}
              onEdit={() => {
                setRegisterStep('email');
                setOtp('');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            />
            <div className="space-y-2">
              <label className="saas-label text-center block">Verification code</label>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="saas-btn-primary w-full py-2.5"
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <div className="auth-back-row">
              <button
                type="button"
                onClick={() => {
                  setRegisterStep('password');
                  setOtp('');
                  setSuccessMsg('');
                  setErrorMsg('');
                }}
              >
                ← Back
              </button>
              <button type="button" disabled={loading || cooldown > 0} onClick={() => void sendOtp()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {!isAdminAuth && authMode === 'signin' && (
          <p className="auth-footer-link">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => switchAuthMode('register')}>
              Create account
            </button>
          </p>
        )}

        {!isAdminAuth && authMode === 'register' && registerStep === 'email' && (
          <p className="auth-footer-link">
            Already have an account?{' '}
            <button type="button" onClick={() => switchAuthMode('signin')}>
              Sign in
            </button>
          </p>
        )}

        {!isAdminAuth &&
          authMode === 'register' &&
          registerStep === 'password' &&
          errorMsg.toLowerCase().includes('already registered') && (
            <p className="auth-footer-link">
              <button type="button" onClick={() => switchAuthMode('signin')}>
                Sign in with this email
              </button>
            </p>
          )}

        {showGuestContinue && activeRole === 'buyer' && authMode === 'signin' && (
          <div className="auth-guest-block">
            <p>Prefer not to sign in? Send your cart as a guest enquiry.</p>
            <Link href="/enquiry?type=cart" className="auth-guest-btn">
              Continue as Guest
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
