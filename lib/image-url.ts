const BLOCKED_HOSTS = /(?:^|\.)facebook\.com$|(?:^|\.)fb\.com$|(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$|(?:^|\.)twitter\.com$|(?:^|\.)x\.com$/i;

const ALLOWED_IMAGE_HOSTS =
  /^(?:images\.unsplash\.com|plus\.unsplash\.com|(?:[\w-]+\.)?supabase\.co|qubphaacuuwlpdrsprjl\.supabase\.co|(?:[\w-]+\.)?t3\.tigrisfiles\.io|(?:[\w-]+\.)?t3\.storage\.dev)$/i;

/** Reject obvious non-image URLs (social pages, video links, etc.). */
export function isLikelyImageUrl(src: string): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('data:image/')) return true;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (BLOCKED_HOSTS.test(url.hostname)) return false;
    if (/\/videos?\//i.test(url.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Hostnames allowed by next.config.js `images.remotePatterns`. */
export function isNextImageHost(src: string): boolean {
  const trimmed = src?.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
    return Boolean(trimmed?.startsWith('/'));
  }

  try {
    const { hostname } = new URL(trimmed);
    return ALLOWED_IMAGE_HOSTS.test(hostname);
  } catch {
    return false;
  }
}

export function sanitizeImageUrl(src: string | null | undefined): string {
  const trimmed = String(src ?? '').trim();
  return isLikelyImageUrl(trimmed) ? trimmed : '';
}
