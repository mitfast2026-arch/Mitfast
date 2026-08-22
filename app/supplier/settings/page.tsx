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
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <Key className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">
              Update Password
            </h3>
          </div>

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-[#F0FDF4] text-xs text-[#15803D] flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-[#15803D] shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] text-xs text-[#B91C1C] flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0" />
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
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <Bell className="w-4 h-4 text-[#111315]" />
            <h3 className="type-section">
              Notification Preferences
            </h3>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F7F8] text-[11px] text-[#6B7280]">
            Local-only preview — preferences are not saved to the server in this environment.
          </div>

          <div className="space-y-3 text-xs opacity-80">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F7F8] cursor-pointer hover:bg-[#ECEEF0]">
              <input 
                type="checkbox"
                checked={emailRfqs}
                onChange={(e) => setEmailRfqs(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-[#111315]">New RFQ Alerts</div>
                <div className="text-[#6B7280]">Receive notifications when buyers submit quotation requests for your components.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F7F8] cursor-pointer hover:bg-[#ECEEF0]">
              <input 
                type="checkbox"
                checked={emailOrders}
                onChange={(e) => setEmailOrders(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-[#111315]">Confirmed production order alerts</div>
                <div className="text-[#6B7280]">Receive immediate dispatch alerts when commercial orders are confirmed.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F7F8] cursor-pointer hover:bg-[#ECEEF0]">
              <input 
                type="checkbox"
                checked={emailApprovals}
                onChange={(e) => setEmailApprovals(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#111315] focus:ring-[#111315]"
              />
              <div className="space-y-0.5">
                <div className="font-medium text-[#111315]">QMS Approval Status Updates</div>
                <div className="text-[#6B7280]">Receive updates when product proposals or price changes are audited.</div>
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
