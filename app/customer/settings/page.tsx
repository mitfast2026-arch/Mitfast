"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Lock,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Bell,
  Fingerprint,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CustomerSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth?role=buyer&mode=signin");
          return;
        }

        setUser(user);

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (prof) {
          setProfile(prof);
        }
      } catch (err) {
        console.error("Failed to load user settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess("Account password updated successfully!");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(""), 4000);
      }
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="container-custom py-12 space-y-6 max-w-4xl">
        <div className="h-6 w-48 bg-[#E5E5E5] rounded animate-pulse" />
        <div className="h-64 border border-[#E2E4E8] rounded p-6 space-y-4">
          <div className="h-4 bg-[#ECEEF0] rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom py-10 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="space-y-1 ">
        <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280]">
          <Link
            href="/customer/dashboard"
            className="hover:text-[#111315] flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Dashboard</span>
          </Link>
          <span>/</span>
          <span className="text-[#111315] font-semibold">Procurement account settings</span>
        </div>
        <h1 className="type-page">Security & Account Preferences</h1>
        <p className="text-xs text-[#6B7280]">
          Manage your buyer authentication credentials, procurement sessions,
          and account security.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Password Update Form */}
        <div className="md:col-span-8 space-y-6">
          <div className="saas-panel p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
              <Lock className="w-4 h-4 text-[#111315]" />
              <h2 className="text-sm font-bold text-[#111315] uppercase tracking-wider font-mono">
                Update Password
              </h2>
            </div>

            {passwordSuccess && (
              <div className="p-3 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#15803D] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className="saas-label">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="saas-input"
                />
              </div>

              <div className="space-y-1">
                <label className="saas-label">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="saas-input"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="saas-btn-primary gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {savingPassword ? "Updating..." : "Update Password"}
                </span>
              </button>
            </form>
          </div>

          {/* Account Security Information */}
          <div className="saas-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
              <Shield className="w-4 h-4 text-[#111315]" />
              <h2 className="text-sm font-bold text-[#111315] uppercase tracking-wider font-mono">
                Authentication Identity
              </h2>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#6B7280]">Primary Account Email</span>
                <span className="font-semibold text-[#111315]">
                  {profile?.email || user?.email}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#6B7280]">Account Role</span>
                <span className="font-semibold text-[#15803D] uppercase">
                  Verified Buyer
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F4F4F5]">
                <span className="text-[#6B7280]">User ID Identifier</span>
                <span className="text-[#6B7280]">
                  {user?.id?.slice(0, 18)}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Security Guidance */}
        <div className="md:col-span-4 space-y-4">
          <div className="saas-panel p-5 space-y-3 text-xs">
            <div className="font-semibold text-[#111315] flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-[#111315]" />
              <span>B2B Security Protocols</span>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-[11px]">
              All commercial RFQ pricing and delivery address data are
              cryptographically signed and isolated at the row-level security
              layer.
            </p>
          </div>

          <div className="saas-panel p-5 space-y-2 text-xs">
            <div className="font-semibold text-[#111315] flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#111315]" />
              <span>RFQ Status Notifications</span>
            </div>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              Automated system updates regarding RFQ acceptance, technical
              drawing review, and dispatch milestones are reflected in your
              dashboard in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
