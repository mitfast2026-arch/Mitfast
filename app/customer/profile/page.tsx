"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  MapPin,
  Mail,
  Phone,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CustomerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [address, setAddress] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchProfile() {
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

        const res = await fetch(`/api/customer/profile?userId=${user.id}`);
        const json = await res.json();

        if (json.success && json.data) {
          const prof = json.data.profile;
          const addr = json.data.address;

          setProfile(prof);
          setFullName(prof.full_name || "");
          setEmail(prof.email || "");
          setPhone(prof.phone || "");

          if (addr) {
            setAddress(addr);
            setAddressLine1(addr.address_line_1 || "");
            setAddressLine2(addr.address_line_2 || "");
            setCity(addr.city || "");
            setStateName(addr.state || "");
            setPostalCode(addr.postal_code || "");
            setCountry(addr.country || "India");
          }
        }
      } catch (err: any) {
        console.error("Failed to load customer profile:", err);
        setErrorMsg("Failed to load profile details");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile?.id,
          fullName,
          phone,
          email,
          address: {
            address_line_1: addressLine1,
            address_line_2: addressLine2,
            city,
            state: stateName,
            postal_code: postalCode,
            country,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || "Failed to update profile");
      } else {
        setSuccessMsg("Profile and delivery address updated successfully!");
        if (json.data.profile) setProfile(json.data.profile);
        if (json.data.address) setAddress(json.data.address);
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Server error updating profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container-custom py-12 space-y-6 max-w-4xl">
        <div className="h-6 w-48 bg-[#E5E5E5] rounded animate-pulse" />
        <div className="h-64 border border-[#E2E4E8] rounded p-6 space-y-4">
          <div className="h-4 bg-[#ECEEF0] rounded w-1/3" />
          <div className="h-10 bg-[#ECEEF0] rounded" />
          <div className="h-10 bg-[#ECEEF0] rounded" />
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
          <span className="text-[#111315] font-semibold">Procurement account profile</span>
        </div>
        <h1 className="type-page">Buyer Profile & Delivery Location</h1>
        <p className="text-xs text-[#6B7280]">
          Manage your organizational contact details and primary delivery
          address for RFQs and shipments.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#15803D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Contact Information */}
        <div className="saas-panel p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <User className="w-4 h-4 text-[#111315]" />
            <h2 className="text-sm font-bold text-[#111315] uppercase tracking-wider font-mono">
              1. Contact Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="saas-label">
                Full Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Commander John Shepard"
                  className="saas-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="saas-label">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="saas-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="saas-label">
                Phone / Mobile Number *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="saas-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Delivery Address */}
        <div className="saas-panel p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[#E2E4E8] pb-3">
            <MapPin className="w-4 h-4 text-[#111315]" />
            <h2 className="text-sm font-bold text-[#111315] uppercase tracking-wider font-mono">
              2. Primary Delivery Address
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="saas-label">
                Address Line 1 (Street / Industrial Area) *
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. Plot 42, Devanahalli Aerospace SEZ"
                className="saas-input"
              />
            </div>

            <div className="space-y-1">
              <label className="saas-label">
                Address Line 2 (Building / Bay / Suite)
              </label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="e.g. Hangar 4, Material Inward Gate"
                className="saas-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="saas-label">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="saas-input"
                />
              </div>

              <div className="space-y-1">
                <label className="saas-label">
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. Karnataka"
                  className="saas-input"
                />
              </div>

              <div className="space-y-1">
                <label className="saas-label">
                  Postal Code (PIN) *
                </label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 562110"
                  className="saas-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="saas-label">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="saas-input"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280] font-mono">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <span>Delivery details are attached to future RFQ submissions</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="saas-btn-primary gap-2 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving Changes..." : "Save Profile Details"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
