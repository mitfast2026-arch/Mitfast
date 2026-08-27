import { unstable_cache } from 'next/cache';
import { getHomepagePublicBundle } from '@/lib/server/homepage/homepage-cms-service';

export function getCachedHomepageCms() {
  return unstable_cache(
    async () => getHomepagePublicBundle(),
    ['homepage-cms'],
    {
      revalidate: 60,
      tags: ['homepage'],
    }
  )();
}
