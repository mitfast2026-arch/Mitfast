'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export interface SupplierRecord {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  status: string;
  created_at?: string;
}

interface SupplierContextValue {
  supplier: SupplierRecord | null;
  loading: boolean;
  refreshSupplier: () => Promise<void>;
}

const SupplierContext = createContext<SupplierContextValue | null>(null);

export function SupplierProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDoneRef = useRef(false);

  const refreshSupplier = useCallback(async () => {
    if (!initialLoadDoneRef.current) setLoading(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth?role=supplier&mode=signin');
        return;
      }

      const { data: sup } = await supabase
        .from('suppliers')
        .select(
          'id, user_id, company_name, contact_person, email, phone, country, address, status, rejection_reason, created_at'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (sup) setSupplier(sup as SupplierRecord);
    } catch (err) {
      console.error('Failed to load supplier profile:', err);
    } finally {
      setLoading(false);
      initialLoadDoneRef.current = true;
    }
  }, [router]);

  useEffect(() => {
    void refreshSupplier();
  }, [refreshSupplier]);

  return (
    <SupplierContext.Provider value={{ supplier, loading, refreshSupplier }}>
      {children}
    </SupplierContext.Provider>
  );
}

export function useSupplier() {
  const ctx = useContext(SupplierContext);
  if (!ctx) {
    throw new Error('useSupplier must be used within SupplierProvider');
  }
  return ctx;
}
