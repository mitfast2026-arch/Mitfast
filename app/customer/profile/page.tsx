"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CustomerPageShell, CustomerPageSkeleton } from "@/components/customer/CustomerPageShell";

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

        const res = await fetch('/api/customer/profile');
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
    return <CustomerPageSkeleton blocks={2} />;
  }

  return (
    <CustomerPageShell
      title="Profile"
      subtitle="Manage your buyer credentials, contact details, and primary delivery address."
    >

      {successMsg && (
        <div className="p-4 rounded-xl bg-[#E8F5EC] border border-[#D9DCE1] text-sm font-medium text-[#15803D] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FDECEC] border border-[#D9DCE1] text-sm font-medium text-[#B91C1C] flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="buyer-surface-grad buyer-surface-grad--sky p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3">
            <User className="w-4 h-4 text-[#6B7280]" />
            <h2 className="text-sm font-semibold text-[#111315]">Contact information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Full name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Email address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Phone / mobile *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="buyer-flush px-0.5 space-y-5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#6B7280]" />
            <h2 className="text-sm font-semibold text-[#111315]">Primary delivery address</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Address line 1 *</label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. Plot 42, Industrial Zone"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Address line 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="e.g. Building / Gate No."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#6B7280] mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#6B7280] mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. Karnataka"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#6B7280] mb-1">PIN code *</label>
                <input
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 562110"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <span>Delivery details are used automatically on future orders.</span>
          </div>

          <button type="submit" disabled={saving} className="buyer-cta">
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving…' : 'Save profile'}</span>
          </button>
        </div>
      </form>
    </CustomerPageShell>
  );
}
