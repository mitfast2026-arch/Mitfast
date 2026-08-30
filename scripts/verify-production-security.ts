import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { resolve } from 'path';

// Load env files
const envLocal = dotenv.parse(fs.readFileSync(resolve(process.cwd(), '.env.local')));
for (const [k, v] of Object.entries(envLocal)) {
  process.env[k] = v;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('================================================================');
console.log('MITFAST PRODUCTION SECURITY & SCHEMA AUDIT PROBE');
console.log('Target Supabase:', supabaseUrl);
console.log('================================================================\n');

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const report: Record<string, { status: 'PASS' | 'FAIL' | 'PENDING_MIGRATION' | 'UNKNOWN'; details: string }> = {};

  // 1. Probe anon execute on SECURITY DEFINER RPCs with signature payloads
  console.log('1. Checking RPC Permissions (Anon Probes with signatures)...');
  const rpcProbes: Array<{ name: string; payload: Record<string, any> }> = [
    {
      name: 'submit_rfqs_from_cart_atomic',
      payload: {
        p_customer_id: '00000000-0000-0000-0000-000000000000',
        p_delivery_address: {},
        p_customer_message: 'probe',
        p_groups: [],
      },
    },
    {
      name: 'submit_rfq_from_cart_atomic',
      payload: {
        p_customer_id: '00000000-0000-0000-0000-000000000000',
        p_rfq_number: 'RFQ-PROBE',
        p_delivery_address: {},
        p_customer_message: 'probe',
        p_original_total: 100,
        p_items: [],
      },
    },
    {
      name: 'create_rfq_from_enquiry_atomic',
      payload: {
        p_enquiry_id: '00000000-0000-0000-0000-000000000000',
        p_customer_id: '00000000-0000-0000-0000-000000000000',
        p_rfq_number: 'RFQ-PROBE',
        p_delivery_address: {},
        p_customer_message: 'probe',
        p_original_total: 100,
        p_items: [],
      },
    },
    {
      name: 'try_record_otp_send',
      payload: {
        p_email: 'probe@example.com',
        p_cooldown_seconds: 60,
        p_max_per_hour: 5,
      },
    },
  ];

  for (const { name: rpcName, payload } of rpcProbes) {
    const { data, error, status } = await anonClient.rpc(rpcName, payload as any);
    const isDenied =
      status === 401 ||
      status === 403 ||
      status === 404 ||
      (error && (error.code === '42501' || error.code === 'PGRST202' || error.message?.includes('permission denied') || error.message?.includes('Could not find the function')));

    if (isDenied) {
      console.log(`  [PASS] ${rpcName}: Denied to anon (status: ${status}, code: ${error?.code || 'N/A'})`);
      report[`rpc_${rpcName}`] = { status: 'PASS', details: `Denied to anon (${status || error?.code})` };
    } else {
      console.log(`  [EXPOSED] ${rpcName}: Executable by anon! (status: ${status}, error: ${error?.message || 'executed'})`);
      report[`rpc_${rpcName}`] = { status: 'FAIL', details: `Executable by anon (${error?.message || 'executed'})` };
    }
  }

  // 2. Check rfq_items GST columns
  console.log('\n2. Checking rfq_items GST Snapshot Columns...');
  const { data: rfqRow, error: rfqErr } = await serviceClient
    .from('rfq_items')
    .select('id, gst_rate, gst_included')
    .limit(1);

  if (rfqErr && rfqErr.message.includes('does not exist')) {
    console.log(`  [PENDING] rfq_items GST columns: ${rfqErr.message}`);
    report['gst_snapshot_columns'] = { status: 'PENDING_MIGRATION', details: rfqErr.message };
  } else if (!rfqErr) {
    console.log(`  [PASS] rfq_items.gst_rate and gst_included exist.`);
    report['gst_snapshot_columns'] = { status: 'PASS', details: 'Columns exist in rfq_items schema' };
  } else {
    console.log(`  [UNKNOWN] rfq_items query error: ${rfqErr.message}`);
    report['gst_snapshot_columns'] = { status: 'UNKNOWN', details: rfqErr.message };
  }

  // 3. Check api_rate_limit_log RLS
  console.log('\n3. Checking api_rate_limit_log access from anon...');
  const { data: rateLogAnon, error: rateLogErr } = await anonClient
    .from('api_rate_limit_log')
    .select('id')
    .limit(1);

  if (rateLogErr && (rateLogErr.code === '42501' || rateLogErr.message.includes('permission denied') || rateLogErr.message.includes('not found') || rateLogErr.code === 'PGRST301')) {
    console.log(`  [PASS] api_rate_limit_log is protected from anon (${rateLogErr.message})`);
    report['api_rate_limit_log_rls'] = { status: 'PASS', details: rateLogErr.message };
  } else if (!rateLogErr) {
    console.log(`  [EXPOSED] api_rate_limit_log readable by anon!`);
    report['api_rate_limit_log_rls'] = { status: 'PENDING_MIGRATION', details: 'Accessible by anon without RLS restriction' };
  } else {
    console.log(`  [INFO] api_rate_limit_log result:`, rateLogErr.message);
    report['api_rate_limit_log_rls'] = { status: 'PENDING_MIGRATION', details: rateLogErr.message };
  }

  // 4. Check Tigris configuration
  console.log('\n4. Checking Storage / Tigris Configuration...');
  const requiredTigris = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'TIGRIS_BUCKET_NAME', 'AWS_ENDPOINT_URL_S3', 'TIGRIS_PUBLIC_URL_BASE'];
  const missingTigris = requiredTigris.filter(k => !process.env[k]);
  if (missingTigris.length === 0) {
    console.log(`  [PASS] All Tigris environment keys present (${requiredTigris.join(', ')})`);
    report['tigris_storage'] = { status: 'PASS', details: 'All S3/Tigris config keys present' };
  } else {
    console.log(`  [FAIL] Missing Tigris keys: ${missingTigris.join(', ')}`);
    report['tigris_storage'] = { status: 'FAIL', details: `Missing: ${missingTigris.join(', ')}` };
  }

  // 5. Check Email configuration
  console.log('\n5. Checking Email Configuration...');
  const emailFrom = process.env.EMAIL_FROM || '';
  const resendKey = process.env.RESEND_API_KEY || '';
  const brevoKey = process.env.BREVO_API_KEY || '';

  if (emailFrom && (resendKey || brevoKey)) {
    console.log(`  [PASS] EMAIL_FROM configured: ${emailFrom}`);
    console.log(`  [PASS] Email providers configured (Resend: ${!!resendKey}, Brevo: ${!!brevoKey})`);
    report['email_config'] = { status: 'PASS', details: `EMAIL_FROM set (${emailFrom}), Resend/Brevo present` };
  } else {
    console.log(`  [FAIL] Email config incomplete (EMAIL_FROM: ${!!emailFrom}, Resend: ${!!resendKey}, Brevo: ${!!brevoKey})`);
    report['email_config'] = { status: 'FAIL', details: 'Missing EMAIL_FROM or provider keys' };
  }

  console.log('\n================================================================');
  console.log('SUMMARY OF PROBES:');
  console.log('================================================================');
  console.table(report);
}

main().catch(err => {
  console.error('Fatal error in probe script:', err);
  process.exit(1);
});
