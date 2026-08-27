/**
 * Smoke probes for Tier 1 (role freeze) + Tier 2 (soft insert lock).
 * Creates ephemeral auth users when JWT env vars are missing.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Optional: CUSTOMER_ACCESS_TOKEN, SUPPLIER_ACCESS_TOKEN, SUPPLIER_ID
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string, ...alts: string[]): string | undefined {
  for (const k of [name, ...alts]) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

async function signInAs(
  url: string,
  anon: string,
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anon || !service) {
    console.log('SKIP — missing Supabase env (URL, ANON, SERVICE_ROLE)');
    process.exit(0);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let failed = 0;
  const cleanupUserIds: string[] = [];
  const cleanupProductIds: string[] = [];

  const { error: profErr } = await admin.from('profiles').select('user_id').limit(1);
  if (profErr) {
    console.error('FAIL — service role profiles read:', profErr.message);
    failed++;
  } else {
    console.log('PASS — service role can read profiles');
  }

  // --- Tier 1: role freeze ---
  const customerToken = env('CUSTOMER_ACCESS_TOKEN');
  let customerClient: SupabaseClient | null = null;
  let customerUid: string | null = null;

  if (customerToken) {
    customerClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${customerToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: me } = await customerClient.auth.getUser();
    customerUid = me.user?.id ?? null;
  } else {
    const email = `smoke.role.${Date.now()}@mitfast.test`;
    const password = `Smoke!${Date.now()}Aa1`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: 'Smoke Customer' },
    });
    if (createErr || !created.user) {
      console.error('FAIL — could not create smoke customer:', createErr?.message);
      failed++;
    } else {
      cleanupUserIds.push(created.user.id);
      customerUid = created.user.id;
      // Ensure profile exists (trigger should create)
      await admin.from('profiles').upsert(
        {
          user_id: created.user.id,
          role: 'customer',
          full_name: 'Smoke Customer',
          email,
          phone: '',
        },
        { onConflict: 'user_id' }
      );
      try {
        customerClient = await signInAs(url, anon, email, password);
      } catch (e) {
        console.error('FAIL —', e instanceof Error ? e.message : e);
        failed++;
      }
    }
  }

  if (customerClient && customerUid) {
    const { error: escErr } = await customerClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', customerUid);

    if (!escErr) {
      console.error('FAIL — customer was able to set role=admin (Tier 1 migration may not be applied)');
      await admin.from('profiles').update({ role: 'customer' }).eq('user_id', customerUid);
      failed++;
    } else {
      console.log('PASS — role escalate blocked:', escErr.message);
    }

    const { error: nameErr } = await customerClient
      .from('profiles')
      .update({ full_name: 'Smoke Test Name' })
      .eq('user_id', customerUid);

    if (nameErr) {
      console.error('FAIL — customer profile name update blocked:', nameErr.message);
      failed++;
    } else {
      console.log('PASS — customer can update full_name');
    }
  }

  // Admin still admin (sample)
  const { data: admins, error: adminListErr } = await admin
    .from('profiles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1);
  if (adminListErr || !admins?.length) {
    console.error('FAIL — no admin profile found / query error:', adminListErr?.message);
    failed++;
  } else {
    console.log('PASS — admin profile(s) still present');
  }

  // --- Tier 2: soft insert ---
  let supplierId = env('SUPPLIER_ID');
  if (!supplierId) {
    const { data: anySupplier } = await admin.from('suppliers').select('id').limit(1).maybeSingle();
    supplierId = anySupplier?.id ?? undefined;
  }

  const supplierToken = env('SUPPLIER_ACCESS_TOKEN');
  let supplierClient: SupabaseClient | null = null;

  if (supplierToken) {
    supplierClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${supplierToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else if (supplierId) {
    const { data: supplierRow } = await admin
      .from('suppliers')
      .select('id, user_id, email')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierRow?.user_id) {
      const email = `smoke.supplier.${Date.now()}@mitfast.test`;
      const password = `Smoke!${Date.now()}Aa1`;
      // Prefer linking to existing supplier user via password reset is hard;
      // create ephemeral supplier user + temporary supplier row ownership is too invasive.
      // Instead probe with a throwaway user that owns a throwaway supplier.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'supplier', full_name: 'Smoke Supplier' },
      });
      if (!createErr && created.user) {
        cleanupUserIds.push(created.user.id);
        await admin.from('profiles').upsert(
          {
            user_id: created.user.id,
            role: 'supplier',
            full_name: 'Smoke Supplier',
            email,
            phone: '',
          },
          { onConflict: 'user_id' }
        );
        const { data: smokeSupplier, error: supInsErr } = await admin
          .from('suppliers')
          .insert({
            user_id: created.user.id,
            company_name: 'Smoke Supplier Co',
            contact_person: 'Smoke',
            email,
            phone: '000',
            status: 'active',
            country: 'IN',
          } as any)
          .select('id')
          .maybeSingle();

        if (!supInsErr && smokeSupplier) {
          supplierId = smokeSupplier.id;
          try {
            supplierClient = await signInAs(url, anon, email, password);
          } catch (e) {
            console.error('FAIL — supplier sign-in:', e instanceof Error ? e.message : e);
            failed++;
          }
          // mark supplier for cleanup via deleting products then supplier
          (globalThis as any).__smokeSupplierId = smokeSupplier.id;
        } else {
          console.log('INFO — could not create smoke supplier row:', supInsErr?.message);
        }
      }
    }
  }

  if (supplierClient && supplierId) {
    const { data: category } = await admin.from('categories').select('id').limit(1).maybeSingle();
    if (!category?.id) {
      console.error('FAIL — no category available for product insert smoke');
      failed++;
    } else {
      const { data: inserted, error: insErr } = await supplierClient
        .from('products')
        .insert({
          name: 'Smoke soft insert',
          sku: `SMOKE-SOFT-${Date.now()}`,
          supplier_id: supplierId,
          category_id: category.id,
          supplier_price: 1,
          selling_price: 999,
          moq: 1,
          approval_status: 'approved',
          publication_status: 'published',
          archive_status: 'active',
        } as any)
        .select('id, approval_status, publication_status, is_draft')
        .maybeSingle();

      if (insErr) {
        console.log('INFO — client insert rejected (acceptable if RLS denies):', insErr.message);
      } else if (inserted) {
        cleanupProductIds.push(inserted.id);
        const ok =
          inserted.approval_status === 'pending' &&
          inserted.publication_status === 'unpublished';
        if (!ok) {
          console.error(
            'FAIL — client insert landed live (Tier 2 migration may not be applied):',
            inserted
          );
          failed++;
        } else {
          console.log('PASS — client insert forced pending/unpublished');
        }
      }

      const { data: adminProd, error: adminInsErr } = await admin
        .from('products')
        .insert({
          name: 'Smoke admin insert',
          sku: `SMOKE-ADMIN-${Date.now()}`,
          supplier_id: supplierId,
          category_id: category.id,
          supplier_price: 1,
          selling_price: 10,
          moq: 1,
          approval_status: 'pending',
          publication_status: 'unpublished',
          archive_status: 'active',
        } as any)
        .select('id')
        .maybeSingle();

      if (adminInsErr || !adminProd) {
        console.error('FAIL — service-role product insert failed:', adminInsErr?.message);
        failed++;
      } else {
        cleanupProductIds.push(adminProd.id);
        console.log('PASS — service-role product insert works');
      }
    }
  } else {
    console.log('SKIP — could not obtain supplier client/id for soft insert probe');
  }

  // Cleanup
  for (const id of cleanupProductIds) {
    await admin.from('products').delete().eq('id', id);
  }
  const smokeSupplierId = (globalThis as any).__smokeSupplierId as string | undefined;
  if (smokeSupplierId) {
    await admin.from('suppliers').delete().eq('id', smokeSupplierId);
  }
  for (const id of cleanupUserIds) {
    await admin.auth.admin.deleteUser(id);
  }

  console.log(failed === 0 ? 'SMOKE SUMMARY: OK' : `SMOKE SUMMARY: ${failed} failure(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
