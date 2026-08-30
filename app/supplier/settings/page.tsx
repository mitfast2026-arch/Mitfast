'use client';

import React, { useEffect, useState } from 'react';
import {
  Lock,
  Bell,
  Save,
  Check,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

type NotificationPreferences = {
  emailRfqs: boolean;
  emailOrders: boolean;
  emailApprovals: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  emailRfqs: true,
  emailOrders: true,
  emailApprovals: true,
};

export default function SupplierSettingsPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [emailRfqs, setEmailRfqs] = useState(true);
  const [emailOrders, setEmailOrders] = useState(true);
  const [emailApprovals, setEmailApprovals] = useState(true);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');
  const [prefsError, setPrefsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      setLoadingPrefs(true);
      try {
        const res = await fetch('/api/supplier/profile');
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to load preferences');
        }
        const prefs = (json.data?.supplier?.notification_preferences ||
          DEFAULT_PREFS) as NotificationPreferences;
        if (!cancelled) {
          setEmailRfqs(prefs.emailRfqs !== false);
          setEmailOrders(prefs.emailOrders !== false);
          setEmailApprovals(prefs.emailApprovals !== false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setPrefsError(err.message || 'Could not load notification preferences');
        }
      } finally {
        if (!cancelled) setLoadingPrefs(false);
      }
    }
    void loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPasswordSuccess('Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating password.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSavePreferences() {
    setPrefsError('');
    setPrefsSuccess('');
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPreferences: {
            emailRfqs,
            emailOrders,
            emailApprovals,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to save preferences');
      }
      const prefs = (json.data?.supplier?.notification_preferences || {
        emailRfqs,
        emailOrders,
        emailApprovals,
      }) as NotificationPreferences;
      setEmailRfqs(prefs.emailRfqs !== false);
      setEmailOrders(prefs.emailOrders !== false);
      setEmailApprovals(prefs.emailApprovals !== false);
      setPrefsSuccess('Notification preferences saved.');
      setTimeout(() => setPrefsSuccess(''), 4000);
    } catch (err: any) {
      setPrefsError(err.message || 'Could not save preferences');
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="type-page">
          Supplier account settings & security
        </h1>
        <p className="type-subtitle">
          Manage your account credentials, login security, and automated notification alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleUpdatePassword} className="saas-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Key className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">
              Update Password
            </h3>
          </div>

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-portal-success shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-portal-danger shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="saas-label" htmlFor="sup-new-pw">New Password</label>
              <div className="relative">
                <input
                  id="sup-new-pw"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="saas-input text-xs pr-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-portal-muted hover:text-portal-fg p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="saas-label" htmlFor="sup-confirm-pw">Confirm New Password</label>
              <div className="relative">
                <input
                  id="sup-confirm-pw"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="saas-input text-xs pr-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-portal-muted hover:text-portal-fg p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-accent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="saas-btn-primary text-xs py-2 px-4 w-full flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>

        <div className="saas-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Bell className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">
              Notification Preferences
            </h3>
          </div>

          {prefsSuccess && (
            <div className="p-3 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-portal-success shrink-0" />
              <span>{prefsSuccess}</span>
            </div>
          )}

          {prefsError && (
            <div className="p-3 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-portal-danger shrink-0" />
              <span>{prefsError}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-portal-inset cursor-pointer hover:bg-portal-inset">
              <input
                type="checkbox"
                checked={emailRfqs}
                disabled={loadingPrefs || savingPrefs}
                onChange={(e) => setEmailRfqs(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-portal-text focus:ring-portal-accent"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-portal-text">New RFQ Alerts</div>
                <div className="text-portal-muted">Receive notifications when buyers submit quotation requests for your products.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-portal-inset cursor-pointer hover:bg-portal-inset">
              <input
                type="checkbox"
                checked={emailOrders}
                disabled={loadingPrefs || savingPrefs}
                onChange={(e) => setEmailOrders(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-portal-text focus:ring-portal-accent"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-portal-text">Confirmed order alerts</div>
                <div className="text-portal-muted">Receive alerts when buyers confirm orders.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-portal-inset cursor-pointer hover:bg-portal-inset">
              <input
                type="checkbox"
                checked={emailApprovals}
                disabled={loadingPrefs || savingPrefs}
                onChange={(e) => setEmailApprovals(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-portal-text focus:ring-portal-accent"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-portal-text">Approval status updates</div>
                <div className="text-portal-muted">Receive updates when product proposals or price changes are audited.</div>
              </div>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={loadingPrefs || savingPrefs}
              onClick={() => void handleSavePreferences()}
              className="saas-btn-primary text-xs py-2 px-4 w-full flex items-center justify-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingPrefs ? 'Saving…' : loadingPrefs ? 'Loading…' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
