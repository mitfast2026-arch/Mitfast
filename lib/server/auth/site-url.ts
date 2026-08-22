export function getSiteUrl(originHeader?: string | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (originHeader) return originHeader.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export function getEmailRedirectTo(originHeader?: string | null): string {
  return `${getSiteUrl(originHeader)}/auth/callback`;
}
