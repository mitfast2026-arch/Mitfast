const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('--- 1. CREATING DEDICATED ADMIN & SUPPLIER ACCOUNTS ---');

  // --- ADMIN USER ---
  const adminEmail = 'dedicated.admin@mitfast.com';
  const adminPassword = 'Password@12345';
  
  // Check if admin user already exists
  const { data: existingAdminUsers } = await adminClient.auth.admin.listUsers();
  let adminUser = existingAdminUsers?.users?.find((u) => u.email === adminEmail);

  if (!adminUser) {
    const { data: newAdmin, error: adminErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'Dedicated Super Admin' },
    });
    if (adminErr) throw adminErr;
    adminUser = newAdmin.user;
    console.log('Created dedicated admin auth user:', adminUser.id);
  } else {
    console.log('Existing dedicated admin auth user found:', adminUser.id);
    await adminClient.auth.admin.updateUserById(adminUser.id, { password: adminPassword });
  }

  // Ensure admin profile exists and has role = 'admin'
  const { data: adminProfile, error: adminProfErr } = await adminClient
    .from('profiles')
    .upsert(
      {
        user_id: adminUser.id,
        email: adminEmail,
        full_name: 'Dedicated Super Admin',
        role: 'admin',
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (adminProfErr) console.error('Error upserting admin profile:', adminProfErr);
  console.log('Dedicated Admin Profile:', adminProfile);

  // --- SUPPLIER USER ---
  const supplierEmail = 'dedicated.supplier@mitfast.com';
  const supplierPassword = 'Password@12345';
  const supplierCompany = 'Apex Aerospace & Fasteners Pvt Ltd';

  let supplierUser = existingAdminUsers?.users?.find((u) => u.email === supplierEmail);
  if (!supplierUser) {
    const { data: newSupplier, error: supErr } = await adminClient.auth.admin.createUser({
      email: supplierEmail,
      password: supplierPassword,
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: 'Apex Commercial Lead' },
    });
    if (supErr) throw supErr;
    supplierUser = newSupplier.user;
    console.log('Created dedicated supplier auth user:', supplierUser.id);
  } else {
    console.log('Existing dedicated supplier auth user found:', supplierUser.id);
    await adminClient.auth.admin.updateUserById(supplierUser.id, { password: supplierPassword });
  }

  // Upsert supplier profile
  const { data: supplierProfile, error: supProfErr } = await adminClient
    .from('profiles')
    .upsert(
      {
        user_id: supplierUser.id,
        email: supplierEmail,
        full_name: 'Apex Commercial Lead',
        role: 'supplier',
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (supProfErr) console.error('Error upserting supplier profile:', supProfErr);

  // Upsert supplier entity in `suppliers` table
  let { data: supplierRecord, error: supTableErr } = await adminClient
    .from('suppliers')
    .select('*')
    .eq('user_id', supplierUser.id)
    .maybeSingle();

  if (!supplierRecord) {
    const { data: insertedSup, error: insertSupErr } = await adminClient
      .from('suppliers')
      .insert({
        user_id: supplierUser.id,
        company_name: supplierCompany,
        contact_person: 'Rajesh Nair',
        email: supplierEmail,
        phone: '+91 98765 01234',
        address: 'Plot 42, Aero Precision Hub, Peenya Industrial Area, Bengaluru, Karnataka 560058',
        country: 'India',
        website: 'https://apex-fasteners.example.com',
        status: 'active',
      })
      .select()
      .single();
    if (insertSupErr) throw insertSupErr;
    supplierRecord = insertedSup;
    console.log('Created supplier record in suppliers table:', supplierRecord.id);
  } else {
    const { data: updatedSup, error: updateSupErr } = await adminClient
      .from('suppliers')
      .update({
        company_name: supplierCompany,
        status: 'active',
        email: supplierEmail,
      })
      .eq('id', supplierRecord.id)
      .select()
      .single();
    if (updateSupErr) throw updateSupErr;
    supplierRecord = updatedSup;
    console.log('Updated existing supplier record:', supplierRecord.id);
  }

  console.log('\n--- 2. SEEDING 5 INDUSTRIAL PRODUCTS ---');

  const catFastenersId = '5359bdf7-cf8e-44f3-998a-5df580bfd33f';
  const catCncId = '27feb2a9-80e2-48a3-af68-01a652794104';
  const catHydraulicId = '1039909e-c4af-4730-a7e4-acfa7ab9ec25';

  const productsToCreate = [
    {
      name: 'Hex Flange Bolts M10x60 Grade 8.8',
      category_id: catFastenersId,
      supplier_id: supplierRecord.id,
      description: 'High tensile zinc-plated carbon steel hex flange bolts designed for automotive chassis and heavy equipment assembly.',
      moq: 100,
      suggested_moq: 100,
      supplier_price: 35.0,
      profit_type: 'fixed',
      profit_value: 10.0,
      selling_price: 45.0,
      discount: 0,
      gst_rate: 18.0,
      gst_included: false,
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      ribbon_label: 'Best Seller',
      specs: [
        { spec_name: 'Material Grade', spec_value: 'Class 8.8 High Tensile Steel', sort_order: 1 },
        { spec_name: 'Thread Size', spec_value: 'M10 x 1.5 Pitch', sort_order: 2 },
        { spec_name: 'Length', spec_value: '60 mm', sort_order: 3 },
        { spec_name: 'Coating', spec_value: 'Yellow Zinc Chromate Passivated', sort_order: 4 },
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1586864387789-628af9feed72?w=800&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 },
      ],
    },
    {
      name: 'Precision Stainless CNC Flange 50mm',
      category_id: catCncId,
      supplier_id: supplierRecord.id,
      description: '5-axis CNC machined 316L stainless steel blind & weld-neck flange with precision Ra 0.8 surface finish for aerospace & chemical piping.',
      moq: 25,
      suggested_moq: 25,
      supplier_price: 520.0,
      profit_type: 'fixed',
      profit_value: 100.0,
      selling_price: 620.0,
      discount: 0,
      gst_rate: 18.0,
      gst_included: false,
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      ribbon_label: 'Precision Engineered',
      specs: [
        { spec_name: 'Alloy', spec_value: 'AISI 316L Marine Stainless', sort_order: 1 },
        { spec_name: 'Nominal Bore', spec_value: '50 mm (2")', sort_order: 2 },
        { spec_name: 'Machining Tolerance', spec_value: '± 0.02 mm', sort_order: 3 },
        { spec_name: 'Pressure Class', spec_value: 'PN40 / Class 300', sort_order: 4 },
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 },
      ],
    },
    {
      name: 'High-Pressure Hydraulic Coupler 1/4" NPT',
      category_id: catHydraulicId,
      supplier_id: supplierRecord.id,
      description: 'ISO 7241-A compliant quick-disconnect hydraulic quick coupler with fluorocarbon FKM seals rated up to 350 bar.',
      moq: 10,
      suggested_moq: 10,
      supplier_price: 950.0,
      profit_type: 'fixed',
      profit_value: 200.0,
      selling_price: 1150.0,
      discount: 0,
      gst_rate: 18.0,
      gst_included: false,
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      ribbon_label: 'Heavy Duty',
      specs: [
        { spec_name: 'Port Size', spec_value: '1/4" NPT Female', sort_order: 1 },
        { spec_name: 'Max Pressure', spec_value: '350 Bar (5,000 PSI)', sort_order: 2 },
        { spec_name: 'Seal Material', spec_value: 'FKM Viton Rubber', sort_order: 3 },
        { spec_name: 'Standard', spec_value: 'ISO 7241-A', sort_order: 4 },
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 },
      ],
    },
    {
      name: 'Heavy Duty Carbon Steel Stud Bolt M16',
      category_id: catFastenersId,
      supplier_id: supplierRecord.id,
      description: 'ASTM A193 Grade B7 fully threaded stud bolts with 2x Heavy Hex Nuts A194 2H for pressure vessels and structural flanges.',
      moq: 50,
      suggested_moq: 50,
      supplier_price: 145.0,
      profit_type: 'fixed',
      profit_value: 35.0,
      selling_price: 180.0,
      discount: 0,
      gst_rate: 18.0,
      gst_included: false,
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      ribbon_label: null,
      specs: [
        { spec_name: 'Specification', spec_value: 'ASTM A193 Grade B7', sort_order: 1 },
        { spec_name: 'Thread Size', spec_value: 'M16 x 2.0', sort_order: 2 },
        { spec_name: 'Overall Length', spec_value: '120 mm', sort_order: 3 },
        { spec_name: 'Included Nuts', spec_value: '2x ASTM A194 Grade 2H Nuts', sort_order: 4 },
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 },
      ],
    },
    {
      name: 'Pneumatic Quick-Release Air Valve 8mm',
      category_id: catHydraulicId,
      supplier_id: supplierRecord.id,
      description: 'Push-in pneumatic control valve with nickel-plated brass body and POM release sleeve for automated air line circuits.',
      moq: 20,
      suggested_moq: 20,
      supplier_price: 380.0,
      profit_type: 'fixed',
      profit_value: 100.0,
      selling_price: 480.0,
      discount: 0,
      gst_rate: 18.0,
      gst_included: false,
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      ribbon_label: 'Pneumatics',
      specs: [
        { spec_name: 'Tube Outer Diameter', spec_value: '8 mm', sort_order: 1 },
        { spec_name: 'Operating Pressure', spec_value: '0 to 10 Bar', sort_order: 2 },
        { spec_name: 'Fluid Media', spec_value: 'Filtered Compressed Air / Vacuum', sort_order: 3 },
        { spec_name: 'Body Material', spec_value: 'Electroless Nickel Plated Brass', sort_order: 4 },
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 },
      ],
    },
  ];

  const createdProducts = [];

  for (const item of productsToCreate) {
    const { specs, images, ...prodData } = item;

    // Check if product with this name already exists
    const { data: existingProd } = await adminClient
      .from('products')
      .select('id')
      .eq('name', prodData.name)
      .maybeSingle();

    let productId = existingProd?.id;

    if (!productId) {
      const { data: newProd, error: prodErr } = await adminClient
        .from('products')
        .insert(prodData)
        .select()
        .single();
      if (prodErr) throw prodErr;
      productId = newProd.id;
      console.log(`Inserted product: "${prodData.name}" (${productId})`);
    } else {
      const { error: updateErr } = await adminClient
        .from('products')
        .update(prodData)
        .eq('id', productId);
      if (updateErr) throw updateErr;
      console.log(`Updated product: "${prodData.name}" (${productId})`);
    }

    createdProducts.push({ id: productId, name: prodData.name, price: prodData.selling_price });

    // Insert Specs
    await adminClient.from('product_specifications').delete().eq('product_id', productId);
    if (specs && specs.length > 0) {
      const specPayload = specs.map((s) => ({ ...s, product_id: productId }));
      await adminClient.from('product_specifications').insert(specPayload);
    }

    // Insert Images
    await adminClient.from('product_images').delete().eq('product_id', productId);
    if (images && images.length > 0) {
      const imgPayload = images.map((img) => ({ ...img, product_id: productId }));
      await adminClient.from('product_images').insert(imgPayload);
    }
  }

  console.log('\n--- 3. CREATING 1 DEDICATED ENQUIRY ---');
  const targetProductForEnquiry = createdProducts[0]; // Hex Flange Bolts

  const { data: enquiryRecord, error: enqErr } = await adminClient
    .from('enquiries')
    .insert({
      guest_name: 'Vikram Sharma (Bharat Dynamics)',
      guest_email: 'procurement@bharatdynamics.com',
      guest_phone: '+91 98765 43210',
      product_id: targetProductForEnquiry.id,
      message: 'Requesting bulk commercial quotation for 5,000 units with standard mill test certification and 15-day delivery schedule.',
      status: 'new',
    })
    .select()
    .single();

  if (enqErr) console.error('Error inserting enquiry:', enqErr);
  else console.log(`Created enquiry (${enquiryRecord.id}) for "${targetProductForEnquiry.name}"`);

  console.log('\n--- 4. CREATING 1 DEDICATED RFQ ---');

  // Create a buyer auth user & profile for the RFQ
  const buyerEmail = 'buyer@zenithaero.in';
  const buyerPassword = 'Password@12345';
  let buyerUser = existingAdminUsers?.users?.find((u) => u.email === buyerEmail);

  if (!buyerUser) {
    const { data: newBuyer, error: buyerErr } = await adminClient.auth.admin.createUser({
      email: buyerEmail,
      password: buyerPassword,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: 'Zenith Aero Systems' },
    });
    if (buyerErr) throw buyerErr;
    buyerUser = newBuyer.user;
    console.log('Created buyer auth user:', buyerUser.id);
  } else {
    await adminClient.auth.admin.updateUserById(buyerUser.id, { password: buyerPassword });
  }

  const { data: buyerProfile, error: buyerProfErr } = await adminClient
    .from('profiles')
    .upsert(
      {
        user_id: buyerUser.id,
        email: buyerEmail,
        full_name: 'Zenith Aero Systems',
        role: 'customer',
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (buyerProfErr) throw buyerProfErr;

  const targetProductForRfq = createdProducts[1]; // Precision Stainless CNC Flange 50mm
  const rfqQty = 200;
  const unitPrice = 620.0;
  const originalTotal = rfqQty * unitPrice; // 124,000

  const rfqNumber = `RFQ-DED-${Date.now().toString().slice(-6)}`;

  const { data: rfqRecord, error: rfqErr } = await adminClient
    .from('rfqs')
    .insert({
      rfq_number: rfqNumber,
      customer_id: buyerProfile.id,
      status: 'submitted',
      delivery_address_snapshot: {
        recipient_name: 'Zenith Aero Systems Procurement Desk',
        company_name: 'Zenith Aero Systems India Ltd',
        phone: '+91 98765 88990',
        address_line1: 'Aerospace Park, Devanahalli',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '562110',
        country: 'India',
      },
      customer_message: 'Priority RFQ for precision CNC flanges for ongoing aviation structure assembly.',
      original_total: originalTotal,
    })
    .select()
    .single();

  if (rfqErr) throw rfqErr;
  console.log(`Created RFQ: ${rfqRecord.rfq_number} (${rfqRecord.id})`);

  // Insert RFQ Item
  const { error: rfqItemErr } = await adminClient.from('rfq_items').insert({
    rfq_id: rfqRecord.id,
    product_id: targetProductForRfq.id,
    product_name_snapshot: targetProductForRfq.name,
    original_quantity: rfqQty,
    original_unit_price: unitPrice,
    gst_rate: 18.0,
    gst_included: false,
  });

  if (rfqItemErr) console.error('Error inserting RFQ item:', rfqItemErr);
  else console.log(`Created RFQ line item for 200x "${targetProductForRfq.name}"`);

  console.log('\n=========================================');
  console.log('✨ ALL DEDICATED DATA SEEDED SUCCESSFULLY!');
  console.log('=========================================');
}

main().catch(console.error);
