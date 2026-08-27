'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building,
  Save,
  Truck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CustomerPageShell, CustomerPageSkeleton } from '@/components/customer/CustomerPageShell';

export default function CustomerAddressesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [address, setAddress] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');

  async function loadAddress() {
    setLoading(true);
    try {
      const { createBrowserClient } = await import('@/lib/supabase/client');
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth?role=buyer&mode=signin');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('user_id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        const { data: addr } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', prof.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (addr) {
          setAddress(addr);
          setAddressLine1(addr.address_line_1 || '');
          setAddressLine2(addr.address_line_2 || '');
          setCity(addr.city || '');
          setStateName(addr.state || '');
          setPostalCode(addr.postal_code || '');
          setCountry(addr.country || 'India');
        } else {
          setIsEditing(true);
        }
      }
    } catch (err) {
      console.error('Failed to load address:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAddress();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    toast.loading('Saving address...', { id: 'save-address' });

    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile?.id,
          fullName: profile?.full_name,
          phone: profile?.phone,
          email: profile?.email,
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
        const msg = json.error?.message || 'Failed to save address';
        setFeedback({ type: 'error', message: msg });
        toast.error(msg, { id: 'save-address' });
      } else {
        toast.success('Delivery address updated successfully!', { id: 'save-address' });
        setFeedback({ type: 'success', message: 'Delivery address updated successfully!' });
        if (json.data.address) setAddress(json.data.address);
        setIsEditing(false);
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch (err: any) {
      const msg = err.message || 'Error updating address';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg, { id: 'save-address' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CustomerPageSkeleton blocks={1} />;
  }

  return (
    <CustomerPageShell
      title="Addresses"
      subtitle="Your primary delivery destination for orders."
      actions={
        !isEditing && address ? (
          <button type="button" onClick={() => setIsEditing(true)} className="buyer-cta">
            <Edit2 className="w-3.5 h-3.5" />
            Edit address
          </button>
        ) : null
      }
    >

      {feedback ? (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-[#E8F5EC] text-[#15803D]'
              : 'bg-[#FDECEC] text-[#B91C1C]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {!isEditing && address ? (
        <div className="buyer-surface-grad buyer-surface-grad--mint p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#111315] text-white">
              Primary
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold text-[#111315] hover:underline inline-flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <div className="space-y-1 text-[#111315]">
            <div className="font-semibold text-base">{profile?.full_name || 'Consignee'}</div>
            <div className="text-sm text-[#6B7280] leading-relaxed">
              {address.address_line_1}
              {address.address_line_2 ? (
                <>
                  <br />
                  {address.address_line_2}
                </>
              ) : null}
              <br />
              {address.city}, {address.state} —{' '}
              <span className="font-mono text-[#111315]">{address.postal_code}</span>
              <br />
              {address.country || 'India'}
            </div>
            {profile?.phone ? (
              <div className="text-xs text-[#6B7280] pt-2">
                Phone: <span className="font-mono text-[#111315]">{profile.phone}</span>
              </div>
            ) : null}
          </div>

          <div className="pt-3 border-t border-[#D9DCE1] flex items-center gap-2 text-xs text-[#6B7280]">
            <Truck className="w-4 h-4 text-[#15803D]" />
            <span>Used as default for future order consignments</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="buyer-surface-grad buyer-surface-grad--sky p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#D9DCE1] pb-3">
            <h2 className="text-sm font-semibold text-[#111315] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#6B7280]" />
              {address ? 'Edit address' : 'Add address'}
            </h2>
            {address ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-semibold text-[#6B7280] hover:text-[#111315]"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Address line 1 *</label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Address line 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
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
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315] !rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            {address ? (
              <button type="button" onClick={() => setIsEditing(false)} className="buyer-cta-ghost">
                Cancel
              </button>
            ) : null}
            <button type="submit" disabled={saving} className="buyer-cta">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save address'}
            </button>
          </div>
        </form>
      )}
    </CustomerPageShell>
  );
}
