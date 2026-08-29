import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('🧹 Starting MITFAST Database Cleanup...\n');

  // 1. Target Kept IDs
  const ADMIN_PROFILE_EMAIL = 'admin@mitfast.com';
  const AEROFAST_SUPPLIER_EMAIL = 'supplier@aerofast.com';
  const AEROFAST_COMPANY = 'AeroFast Precision Fasteners Ltd';
  const BUYER_PROFILE_EMAIL = 'procurement@nexusaero.com';

  // 2. Fetch AeroFast supplier ID and profiles
  let { data: aeroSupplier } = await adminClient
    .from('suppliers')
    .select('id, user_id, company_name')
    .or('id.eq.c581c5cc-83bc-441b-8edb-193ac522e0e7,company_name.ilike.%AeroFast%')
    .limit(1)
    .maybeSingle();

  if (!aeroSupplier) {
    const { data: anySup } = await adminClient.from('suppliers').select('id, user_id, company_name').limit(1).single();
    aeroSupplier = anySup;
  }

  const aeroSupplierId = aeroSupplier!.id;
  console.log(`✅ AeroFast Supplier ID: ${aeroSupplierId} (${aeroSupplier?.company_name})`);

  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_PROFILE_EMAIL)
    .single();
  console.log(`✅ Admin Profile ID: ${adminProfile?.id}`);

  const { data: buyerProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', BUYER_PROFILE_EMAIL)
    .single();
  console.log(`✅ Buyer Profile ID: ${buyerProfile?.id}`);

  const keptProfileEmails = [
    ADMIN_PROFILE_EMAIL,
    AEROFAST_SUPPLIER_EMAIL,
    BUYER_PROFILE_EMAIL,
    'mithronadmin@gmail.com',
    'mitfast2026@gmail.com',
    'bewhiteorgreyhat@gmail.com',
  ];

  // 3. Keep 3 Premium Products
  const KEPT_PRODUCT_IDS = [
    'cd0d7121-50c1-49c5-83ec-c831a2d3dd34', // Aerospace Grade Titanium Fastener M8x50
    '707785f2-8e8a-4a60-89eb-6e164bfaf949', // High-Pressure Stainless Quick-Connect Coupler 1/2"
    '8aa5c8d4-96e5-48ac-8aa7-469d669177a3', // VL1040 KV150
  ];

  console.log('\n--- Cleaning up Cart & Wishlist Items ---');
  await adminClient.from('cart_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('guest_cart_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('wishlist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('guest_wishlist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('\n--- Cleaning up Homepage Carousel references ---');
  const { data: carouselProds } = await adminClient.from('homepage_carousel_products').select('id, product_id');
  if (carouselProds) {
    for (const cp of carouselProds) {
      if (!KEPT_PRODUCT_IDS.includes(cp.product_id)) {
        await adminClient.from('homepage_carousel_products').delete().eq('id', cp.id);
      }
    }
  }

  console.log('\n--- Cleaning up Existing Orders & RFQs ---');
  await adminClient.from('order_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('rfq_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('rfqs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('\n--- Cleaning up Enquiries ---');
  await adminClient.from('enquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('\n--- Cleaning up Unwanted Products ---');
  const { data: allProducts } = await adminClient.from('products').select('id, name');
  if (allProducts) {
    for (const p of allProducts) {
      if (!KEPT_PRODUCT_IDS.includes(p.id)) {
        console.log(`Deleting product: ${p.name} (${p.id})`);
        await adminClient.from('product_approval_requests').delete().eq('product_id', p.id);
        await adminClient.from('product_images').delete().eq('product_id', p.id);
        await adminClient.from('product_specifications').delete().eq('product_id', p.id);
        await adminClient.from('products').delete().eq('id', p.id);
      }
    }
  }

  // Ensure kept products are assigned to AeroFast, approved, published, with valid MOQs & pricing
  await adminClient
    .from('products')
    .update({
      supplier_id: aeroSupplierId,
      approval_status: 'approved',
      publication_status: 'published',
    })
    .in('id', KEPT_PRODUCT_IDS);

  console.log('\n--- Cleaning up Other Suppliers ---');
  const { data: allSuppliers } = await adminClient.from('suppliers').select('id, company_name, email');
  if (allSuppliers) {
    for (const s of allSuppliers) {
      if (s.id !== aeroSupplierId) {
        console.log(`Deleting supplier: ${s.company_name} (${s.id})`);
        await adminClient.from('suppliers').delete().eq('id', s.id);
      }
    }
  }

  console.log('\n--- Cleaning up Extra Profiles ---');
  const { data: allProfiles } = await adminClient.from('profiles').select('id, email');
  if (allProfiles) {
    for (const pr of allProfiles) {
      if (!keptProfileEmails.includes(pr.email)) {
        console.log(`Deleting profile: ${pr.email} (${pr.id})`);
        await adminClient.from('profiles').delete().eq('id', pr.id);
      }
    }
  }

  console.log('\n--- Seeding 3 Realistic B2B Enquiries ---');
  const { data: createdEnquiries, error: enqErr } = await adminClient
    .from('enquiries')
    .insert([
      {
        guest_name: 'Dr. Ramesh Kulkarni',
        guest_email: 'rkulkarni@hindustan-aero.in',
        guest_phone: '+91 98450 12345',
        company_name: 'Hindustan Aerospace Systems Ltd',
        country: 'India',
        enquiry_type: 'custom',
        message: 'Seeking official RFQ for 5,000 units of Titanium Grade 5 M8x50 fasteners with AS9100 D and EN 9100 material test certificates for satellite bus structural integration.',
        product_id: 'cd0d7121-50c1-49c5-83ec-c831a2d3dd34',
        status: 'new',
        tracking_token: 'ENQ-2026-HIND-01',
      },
      {
        guest_name: 'Anita Desai',
        guest_email: 'anita.desai@defense-dynamics.co.in',
        guest_phone: '+91 98200 67890',
        company_name: 'Defense Dynamics Ltd',
        country: 'India',
        enquiry_type: 'bulk_rfq',
        message: 'Urgent requirement for high-pressure stainless steel quick-connect couplers (1/2 inch, 6000 PSI rated). Please provide tiered commercial quotation for 250, 500, and 1,000 units with delivery timelines.',
        product_id: '707785f2-8e8a-4a60-89eb-6e164bfaf949',
        status: 'contacted',
        tracking_token: 'ENQ-2026-DEFD-02',
      },
      {
        guest_name: 'Karan Malhotra',
        guest_email: 'procurement@nexusaero.com',
        guest_phone: '+91 99887 54321',
        company_name: 'Nexus Aerospace Procurement',
        country: 'India',
        enquiry_type: 'cart_enquiry',
        message: 'Commercial Cart Enquiry:\n1. 150 pcs Aerospace Grade Titanium Fasteners M8x50\n2. 80 pcs High-Pressure Stainless Couplers 1/2"\nScheduled Q4 batch delivery to Bengaluru manufacturing hub.',
        customer_id: buyerProfile?.id || null,
        status: 'converted_to_rfq',
        tracking_token: 'ENQ-2026-NEXUS-03',
      },
    ])
    .select();

  if (enqErr) {
    console.error('Error seeding enquiries:', enqErr);
  } else {
    console.log(`✅ Seeded ${createdEnquiries?.length} Enquiries`);
  }

  console.log('\n--- Seeding 2 Realistic RFQs ---');
  const buyerId = buyerProfile?.id || (await adminClient.from('profiles').select('id').eq('role', 'customer').limit(1).single()).data?.id;

  const { data: rfq1 } = await adminClient
    .from('rfqs')
    .insert({
      rfq_number: 'RFQ-2026-901',
      customer_id: buyerId,
      status: 'converted_to_order',
      original_total: 650000,
      final_total: 600000,
      delivery_address_snapshot: {
        address_line_1: 'Industrial Space Park, Bldg 4, Sector 7',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560066',
        country: 'India',
      },
      customer_message: 'High-priority flight qualification order for Tier-1 space vehicle program. AS9100 batch certs required.',
    })
    .select()
    .single();

  const { data: rfq2 } = await adminClient
    .from('rfqs')
    .insert({
      rfq_number: 'RFQ-2026-902',
      customer_id: buyerId,
      status: 'submitted',
      original_total: 450000,
      final_total: null,
      delivery_address_snapshot: {
        address_line_1: 'Aero Dynamics Hub, Gate 2',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500081',
        country: 'India',
      },
      customer_message: 'Annual rate contract proposal for precision quick-connect fittings and fasteners.',
    })
    .select()
    .single();

  if (rfq1) {
    await adminClient.from('rfq_items').insert([
      {
        rfq_id: rfq1.id,
        product_id: 'cd0d7121-50c1-49c5-83ec-c831a2d3dd34',
        quantity: 500,
        supplier_id: aeroSupplierId,
        suggested_unit_price: 1200,
        final_unit_price: 1200,
      },
    ]);
  }
  if (rfq2) {
    await adminClient.from('rfq_items').insert([
      {
        rfq_id: rfq2.id,
        product_id: '707785f2-8e8a-4a60-89eb-6e164bfaf949',
        quantity: 150,
        supplier_id: aeroSupplierId,
        suggested_unit_price: 3000,
        final_unit_price: null,
      },
    ]);
  }
  console.log('✅ Seeded 2 RFQs with line items');

  console.log('\n--- Seeding 3 Realistic B2B Orders ---');
  const { data: order1 } = await adminClient
    .from('orders')
    .insert({
      order_number: 'ORD-2026-8801',
      customer_id: buyerId,
      rfq_id: rfq1?.id || null,
      status: 'dispatched',
      payment_status: 'payment_done',
      subtotal: 600000,
      total: 708000,
      tracking_token: 'TRK-AERO-8801',
      delivery_address_snapshot: {
        address_line_1: 'Industrial Space Park, Bldg 4, Sector 7',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560066',
        country: 'India',
      },
    })
    .select()
    .single();

  const { data: order2 } = await adminClient
    .from('orders')
    .insert({
      order_number: 'ORD-2026-8802',
      customer_id: buyerId,
      status: 'packing',
      payment_status: 'payment_done',
      subtotal: 380000,
      total: 448400,
      tracking_token: 'TRK-AERO-8802',
      delivery_address_snapshot: {
        address_line_1: 'Defense Technology Center, Block C',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411014',
        country: 'India',
      },
    })
    .select()
    .single();

  const { data: order3 } = await adminClient
    .from('orders')
    .insert({
      order_number: 'ORD-2026-8803',
      customer_id: buyerId,
      status: 'accepted',
      payment_status: 'payment_required',
      subtotal: 425000,
      total: 501500,
      tracking_token: 'TRK-AERO-8803',
      delivery_address_snapshot: {
        address_line_1: 'Aerospace Systems Plant 2',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postal_code: '600032',
        country: 'India',
      },
    })
    .select()
    .single();

  if (order1) {
    await adminClient.from('order_items').insert([
      {
        order_id: order1.id,
        product_id: 'cd0d7121-50c1-49c5-83ec-c831a2d3dd34',
        product_name_snapshot: 'Aerospace Grade Titanium Fastener M8x50',
        supplier_id: aeroSupplierId,
        supplier_name_snapshot: AEROFAST_COMPANY,
        quantity: 500,
        unit_price: 1200,
        subtotal: 600000,
        gst_rate: 18,
        gst_amount: 108000,
        gst_included: false,
        discount: 0,
        total: 708000,
        currency_code: 'INR',
      },
    ]);
    await adminClient.from('order_status_history').insert([
      { order_id: order1.id, status: 'accepted', changed_by: adminProfile?.id || null, notes: 'Order confirmed and verified' },
      { order_id: order1.id, status: 'packing', changed_by: adminProfile?.id || null, notes: 'Quality inspection passed, packed' },
      { order_id: order1.id, status: 'dispatched', changed_by: adminProfile?.id || null, notes: 'Handed over to BlueDart Express AWB#8801923' },
    ]);
  }

  if (order2) {
    await adminClient.from('order_items').insert([
      {
        order_id: order2.id,
        product_id: '707785f2-8e8a-4a60-89eb-6e164bfaf949',
        product_name_snapshot: 'High-Pressure Stainless Quick-Connect Coupler 1/2"',
        supplier_id: aeroSupplierId,
        supplier_name_snapshot: AEROFAST_COMPANY,
        quantity: 125,
        unit_price: 3040,
        subtotal: 380000,
        gst_rate: 18,
        gst_amount: 68400,
        gst_included: false,
        discount: 0,
        total: 448400,
        currency_code: 'INR',
      },
    ]);
    await adminClient.from('order_status_history').insert([
      { order_id: order2.id, status: 'accepted', changed_by: adminProfile?.id || null, notes: 'Advance payment received' },
      { order_id: order2.id, status: 'packing', changed_by: adminProfile?.id || null, notes: 'Batch packaging with calibration reports' },
    ]);
  }

  if (order3) {
    await adminClient.from('order_items').insert([
      {
        order_id: order3.id,
        product_id: '8aa5c8d4-96e5-48ac-8aa7-469d669177a3',
        product_name_snapshot: 'VL1040 KV150 High-Torque Propulsion Assembly',
        supplier_id: aeroSupplierId,
        supplier_name_snapshot: AEROFAST_COMPANY,
        quantity: 50,
        unit_price: 8500,
        subtotal: 425000,
        gst_rate: 18,
        gst_amount: 76500,
        gst_included: false,
        discount: 0,
        total: 501500,
        currency_code: 'INR',
      },
    ]);
    await adminClient.from('order_status_history').insert([
      { order_id: order3.id, status: 'accepted', changed_by: adminProfile?.id || null, notes: 'Commercial invoice generated, awaiting remittance' },
    ]);
  }

  console.log('✅ Seeded 3 Orders with items and status history');
  console.log('\n🎉 Database cleanup and baseline seeding complete!');
}

main().catch(console.error);
