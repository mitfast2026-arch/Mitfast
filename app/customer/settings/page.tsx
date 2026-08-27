'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CustomerPageShell, CustomerPageSkeleton } from '@/components/customer/CustomerPageShell';

export default function CustomerSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth?role=buyer&mode=signin');
          return;
        }

        setUser(user);

        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .eq('user_id', user.id)
          .single();

        if (prof) setProfile(prof);
      } catch (err) {
        console.error('Failed to load user settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setPasswordError(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setPasswordError(msg);
      toast.error(msg);
      return;
    }

    setSavingPassword(true);
    toast.loading('Updating password...', { id: 'update-pw' });
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setPasswordError(error.message);
        toast.error(error.message, { id: 'update-pw' });
      } else {
        toast.success('Password updated successfully', { id: 'update-pw' });
        setPasswordSuccess('Password updated successfully');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to update password';
      setPasswordError(msg);
      toast.error(msg, { id: 'update-pw' });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <CustomerPageSkeleton blocks={3} />;
  }

  return (
    <CustomerPageShell
      title="Security"
      subtitle="Password and account security."
    >

      <div className="buyer-surface-grad buyer-surface-grad--mint p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3">
          <Lock className="w-4 h-4 text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111315]">Update password</h2>
        </div>

        {passwordSuccess ? (
          <div className="p-4 rounded-xl bg-[#E8F5EC] text-sm font-medium text-[#15803D] flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        ) : null}

        {passwordError ? (
          <div className="p-4 rounded-xl bg-[#FDECEC] text-sm font-medium text-[#B91C1C] flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        ) : null}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">New password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Confirm password *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
            />
          </div>
          <button type="submit" disabled={savingPassword} className="buyer-cta">
            <KeyRound className="w-4 h-4" />
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="buyer-flush px-0.5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#6B7280]" />
          <h2 className="text-sm font-semibold text-[#111315]">Account</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 py-2">
            <span className="text-[#6B7280]">Email</span>
            <span className="font-medium text-[#111315] text-right">
              {profile?.email || user?.email}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-[#6B7280]">Role</span>
            <span className="font-medium text-[#15803D]">Verified buyer</span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-[#6B7280]">User ID</span>
            <span className="text-[#6B7280] font-mono text-xs">{user?.id?.slice(0, 18)}…</span>
          </div>
        </div>
      </div>

      <div className="buyer-surface-grad buyer-surface-grad--warm p-5 text-sm space-y-2">
        <div className="font-semibold text-[#111315] flex items-center gap-1.5">
          <Fingerprint className="w-4 h-4" />
          Security
        </div>
        <p className="text-[#6B7280] text-xs leading-relaxed">
          Quotes and order data stay under your signed-in buyer session.
        </p>
      </div>
    </CustomerPageShell>
  );
}
