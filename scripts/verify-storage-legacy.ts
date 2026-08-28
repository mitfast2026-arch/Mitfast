/**
 * Runtime storage config + legacy URL audit helper (verify-tigris-legacy todo).
 * Run: npx tsx scripts/verify-storage-legacy.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config();

import { createAdminClient } from '../lib/supabase/admin';

const required = [
  'TIGRIS_BUCKET_NAME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'TIGRIS_PUBLIC_URL_BASE',
] as const;

function isLegacySupabaseUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('supabase.co/storage') || url.includes('/storage/v1/object/');
}

async function main() {
  console.log('=== Tigris configuration ===');
  for (const key of required) {
    const value = process.env[key]?.trim();
    console.log(`${value ? '✓' : '✗'} ${key}${value ? '' : ' (missing)'}`);
  }

  console.log('\n=== Legacy Supabase URL audit (read-only) ===');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.log('SKIP — missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const admin = createAdminClient();

  const checks: Array<{ label: string; table: string; column: string }> = [
    { label: 'product_images', table: 'product_images', column: 'image_url' },
    { label: 'categories', table: 'categories', column: 'image_url' },
    { label: 'business_settings.logo', table: 'business_settings', column: 'logo_url' },
    { label: 'business_settings.banner', table: 'business_settings', column: 'products_banner_url' },
  ];

  for (const check of checks) {
    const { data, error } = await admin.from(check.table).select(check.column).limit(500);
    if (error) {
      console.warn(`⚠ Could not scan ${check.label}: ${error.message}`);
      continue;
    }
    const legacy = (data || []).filter((row: Record<string, string | null>) =>
      isLegacySupabaseUrl(row[check.column] as string | null)
    );
    console.log(`${check.label}: ${legacy.length} legacy Supabase URL(s) in sample`);
  }

  console.log('\nDone. Migrate legacy rows to Tigris or update URLs in DB when non-zero.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
