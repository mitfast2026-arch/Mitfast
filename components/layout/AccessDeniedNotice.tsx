'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ACCESS_DENIED_PARAM, ACCESS_DENIED_VALUE } from '@/lib/auth/post-auth-path';

export default function AccessDeniedNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    if (searchParams.get(ACCESS_DENIED_PARAM) !== ACCESS_DENIED_VALUE) return;
    if (!shownRef.current) {
      shownRef.current = true;
      toast.error("You don't have access to that page.");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(ACCESS_DENIED_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  return null;
}
