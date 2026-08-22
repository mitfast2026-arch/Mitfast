'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ArrowRight,
  ShoppingCart,
  Building2
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roleParam = searchParams.get('role');
  const initialRole = (roleParam === 'supplier' ? 'supplier' : 'buyer') as 'buyer' | 'supplier';
  const isAdminAuth = roleParam === 'admin';
  const initialMode = (searchParams.get('mode') as 'signin' | 'register') || 'signin';
  const redirectPath = searchParams.get('redirect');

  const [activeRole, setActiveRole] = useState<'buyer' | 'supplier'>(initialRole);
  const [activeMode, setActiveMode] = useState<'signin' | 'register'>(isAdminAuth ? 'signin' : initialMode);

  // Core Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  // Register Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plantAddress, setPlantAddress] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    const r = searchParams.get('role');
    const m = searchParams.get('mode');
    if (r === 'buyer' || r === 'supplier') setActiveRole(r);
    if (r === 'admin') setActiveMode('signin');
    if (m === 'signin' || m === 'register') setActiveMode(m);
    const err = searchParams.get('error');
    if (err && err !== 'missing_code') {
      setErrorMsg(decodeURIComponent(err));
    }
  }, [searchParams]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const supabase = createBrowserClient();

      if (activeMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
            setErrorMsg('Confirm your email before signing in. Check your inbox for the confirmation link.');
            setAwaitingConfirm(true);
          } else {
            setErrorMsg(error.message || 'Invalid email or password.');
          }
          setLoading(false);
          return;
        }

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', data.user.id)
            .single();

          const role = profile?.role;

          if (role === 'admin') {
            if (redirectPath && redirectPath.startsWith('/admin')) {
              router.push(redirectPath);
            } else {
              router.push('/admin/dashboard');
            }
            return;
          }

          if (role === 'supplier') {
            const { data: sup } = await supabase
              .from('suppliers')
              .select('status')
              .eq('user_id', data.user.id)
              .maybeSingle();

            if (sup?.status === 'rejected') {
              router.push('/auth/supplier/rejected');
            } else if (sup?.status === 'pending') {
              router.push('/auth/supplier/pending');
            } else if (redirectPath && redirectPath.startsWith('/supplier')) {
              router.push(redirectPath);
            } else {
              router.push('/supplier/dashboard');
            }
            return;
          }

          if (redirectPath && (redirectPath.startsWith('/cart') || redirectPath.startsWith('/customer') || redirectPath.startsWith('/products') || redirectPath.startsWith('/rfq'))) {
            router.push(redirectPath);
            return;
          }
          router.push('/customer/dashboard');
          return;
        }
      } else {
        // Registration
          if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            setLoading(false);
            return;
          }
        if (activeRole === 'buyer') {
          if (!phone.trim() || !fullName.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
            setErrorMsg('Name, phone, and a complete delivery address are required.');
            setLoading(false);
            return;
          }
          const res = await fetch('/api/auth/register-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
              addressLine1: addressLine1.trim(),
              city: city.trim(),
              state: state.trim(),
              postalCode: postalCode.trim(),
              country: 'India',
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            setErrorMsg(json.error?.message || 'Registration failed');
            setLoading(false);
            return;
          }

          setAwaitingConfirm(true);
          setSuccessMsg('Account created. Confirm your email, then sign in. Guests can keep using enquiry without an account until they confirm.');
          setActiveMode('signin');
          setLoading(false);
          return;

        } else {
          if (!companyName.trim() || !fullName.trim() || !phone.trim() || !plantAddress.trim()) {
            setErrorMsg('Company, contact, phone, and plant address are required.');
            setLoading(false);
            return;
          }
          if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            setLoading(false);
            return;
          }
          const res = await fetch('/api/auth/register-supplier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: companyName.trim(),
              contactPerson: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
              confirmPassword,
              termsAccepted: true,
              address: plantAddress.trim(),
              country: 'India',
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            setErrorMsg(json.error?.message || 'Supplier registration failed');
            setLoading(false);
            return;
          }

          setAwaitingConfirm(true);
          setSuccessMsg('Application submitted. Confirm your email, then wait for admin approval before you can access the supplier portal.');
          setActiveMode('signin');
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen saas-canvas-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-4 text-center">
        <Link href="/" className="inline-block">
          <span className="text-xl font-semibold text-[#111315] tracking-tight">MITFAST B2B</span>
        </Link>
        <h1 className="type-page text-2xl sm:text-2xl">
          {isAdminAuth ? 'Staff sign in' : (activeMode === 'signin' ? 'Sign in' : 'Create enterprise account')}
        </h1>
        <p className="type-subtitle">
          {isAdminAuth
            ? 'Admin command center'
            : (activeRole === 'buyer' ? 'Buyer procurement workspace' : 'Supplier manufacturing network')}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="saas-panel py-8 px-6 space-y-6">
          {!isAdminAuth && (
          <div className="saas-segmented w-full grid grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveRole('buyer')}
              className={`${activeRole === 'buyer' ? 'saas-tab-active' : 'saas-tab-inactive'} inline-flex items-center justify-center gap-1.5`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Buyer
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('supplier')}
              className={`${activeRole === 'supplier' ? 'saas-tab-active' : 'saas-tab-inactive'} inline-flex items-center justify-center gap-1.5`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Supplier
            </button>
          </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#15803D] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {awaitingConfirm && email && (
            <div className="text-center">
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg('');
                  const res = await fetch('/api/auth/resend-confirmation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.trim() }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.success) {
                    setErrorMsg(json.error?.message || 'Could not resend confirmation email.');
                    return;
                  }
                  setSuccessMsg('Confirmation email sent. Check your inbox.');
                }}
                className="text-xs text-[#111315] hover:underline"
              >
                Resend confirmation email
              </button>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {activeMode === 'register' && (
              <>
                {activeRole === 'supplier' && (
                  <div className="space-y-1">
                    <label className="saas-label">Company Legal Entity *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. AeroFast Precision Engineering Ltd"
                      className="saas-input"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="saas-label">
                    {activeRole === 'supplier' ? 'Contact Person Name *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Amit Patel"
                    className="saas-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="saas-label">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="saas-input"
                  />
                </div>

                {activeRole === 'supplier' && (
                  <div className="space-y-1">
                    <label className="saas-label">Plant / Facility Address *</label>
                    <input
                      type="text"
                      required
                      value={plantAddress}
                      onChange={(e) => setPlantAddress(e.target.value)}
                      placeholder="e.g. Peenya Industrial Area, Bengaluru"
                      className="saas-input"
                    />
                  </div>
                )}

                {activeRole === 'buyer' && (
                  <>
                    <div className="space-y-1">
                      <label className="saas-label">Ship-to / delivery address *</label>
                      <input
                        type="text"
                        required
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        placeholder="Plant / warehouse line 1"
                        className="saas-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="saas-label">City *</label>
                        <input required value={city} onChange={(e) => setCity(e.target.value)} className="saas-input" />
                      </div>
                      <div className="space-y-1">
                        <label className="saas-label">State *</label>
                        <input required value={state} onChange={(e) => setState(e.target.value)} className="saas-input" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="saas-label">Postal code *</label>
                      <input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="saas-input" />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="space-y-1">
              <label className="saas-label">Work Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="saas-input"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="saas-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111315]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {activeMode === 'register' && (
              <div className="space-y-1">
                <label className="saas-label">Confirm password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="saas-input"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="saas-btn-primary w-full py-2.5 gap-2"
              >
                <span>{loading ? 'Authenticating...' : (activeMode === 'signin' ? 'Sign In' : 'Create procurement account')}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {!isAdminAuth && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveMode(activeMode === 'signin' ? 'register' : 'signin');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-[#6B7280] hover:text-[#111315]"
              >
                {activeMode === 'signin' 
                  ? "Don't have an enterprise account? Create one" 
                  : 'Already registered? Sign in'}
              </button>
            </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
export default function AuthPageModern() {
  return (
    <Suspense fallback={
      <div className="min-h-screen saas-canvas-bg flex items-center justify-center">
        <div className="text-xs font-mono text-[#6B7280]">Loading authentication...</div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
