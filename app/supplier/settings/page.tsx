'use client';

import React, { useState } from 'react';
import { 
  Lock, 
  Bell, 
  Save, 
  Check, 
  AlertCircle,
  Key
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function SupplierSettingsPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Notification toggles — local-only preview (not persisted)
  const [emailRfqs, setEmailRfqs] = useState(true);
  const [emailOrders, setEmailOrders] = useState(true);
  const [emailApprovals, setEmailApprovals] = useState(true);

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

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="type-page">
          Supplier account settings & security
        </h1>
        <p className="type-subtitle">
          Manage your account credentials, login security, and automated notification alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Update Form */}
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
              <label className="saas-label">New Password</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="saas-input text-xs"
              />
            </div>

            <div>
              <label className="saas-label">Confirm New Password</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="saas-input text-xs"
              />
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

        {/* Notifications — local-only */}
        <div className="saas-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-portal-border pb-3">
            <Bell className="w-4 h-4 text-portal-text" />
            <h3 className="type-section">
              Notification Preferences
            </h3>
          </div>

          <div className="p-3 rounded-xl bg-portal-inset text-[11px] text-portal-muted">
            Local-only preview — preferences are not saved to the server in this environment.
          </div>

          <div className="space-y-3 text-xs opacity-80">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-portal-inset cursor-pointer hover:bg-portal-inset">
              <input 
                type="checkbox"
                checked={emailRfqs}
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
              disabled
              title="Notification preferences are not persisted in this environment"
              className="saas-btn-secondary text-xs py-2 px-4 w-full flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preferences (unavailable)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
