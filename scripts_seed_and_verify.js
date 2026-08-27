const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedDatabase() {
  console.log('====================================================');
  console.log('MITFAST Backend — Database Seeding & Setup');
  console.log('====================================================\n');

  // 1. Seed Categories
  console.log('1. Seeding Categories...');
  const categoryNames = [
    'Industrial Fasteners',
    'Precision CNC Components',
    'Hydraulic & Pneumatic Fittings',
    'Electrical & Wire Management',
    'Sealing & Gasket Solutions',
  ];

  const categoryMap = {};
  for (const name of categoryNames) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      categoryMap[name] = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      categoryMap[name] = created.id;
    }
  }
  console.log('✓ Categories verified:', Object.keys(categoryMap).length);

  // 2. Seed Admin User
  console.log('\n2. Seeding Admin Account...');
  const adminEmail = 'admin@mitfast.com';
  const adminPassword = 'Password@123456';

  let adminUserId = null;
  const { data: userList } = await supabase.auth.admin.listUsers();
  const existingAdminUser = userList?.users?.find(u => u.email === adminEmail);

  if (existingAdminUser) {
    adminUserId = existingAdminUser.id;
  } else {
    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', full_name: 'MITFAST Super Admin' },
    });
    if (createError) throw createError;
    adminUserId = createdUser.user.id;
  }

  const { data: adminProfile, error: profError } = await supabase
    .from('profiles')
    .upsert({
      user_id: adminUserId,
      role: 'admin',
      full_name: 'MITFAST Super Admin',
      email: adminEmail,
      phone: '+919876543210',
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (profError) throw profError;
  console.log('✓ Admin Profile active:', adminProfile.email, `(Role: ${adminProfile.role})`);

  // 3. Seed Demo Supplier
  console.log('\n3. Seeding Demo Supplier Account...');
  const supplierEmail = 'supplier@aerofast.com';
  const supplierPassword = 'Password@123456';

  let supplierUserId = null;
  const existingSupplierUser = userList?.users?.find(u => u.email === supplierEmail);
  if (existingSupplierUser) {
    supplierUserId = existingSupplierUser.id;
  } else {
    const { data: createdSupplier, error: supCreateErr } = await supabase.auth.admin.createUser({
      email: supplierEmail,
      password: supplierPassword,
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: 'AeroFast Commercial Team' },
    });
    if (supCreateErr) throw supCreateErr;
    supplierUserId = createdSupplier.user.id;
  }

  await supabase.from('profiles').upsert({
    user_id: supplierUserId,
    role: 'supplier',
    full_name: 'AeroFast Commercial Team',
    email: supplierEmail,
    phone: '+919988776655',
  }, { onConflict: 'user_id' });

  // Check if supplier record exists
  let supplierRecord = null;
  const { data: existingSup } = await supabase
    .from('suppliers')
    .select('*')
    .eq('email', supplierEmail)
    .maybeSingle();

  if (existingSup) {
    supplierRecord = existingSup;
  } else {
    const { data: createdSup, error: supRecordErr } = await supabase
      .from('suppliers')
      .insert({
        user_id: supplierUserId,
        company_name: 'AeroFast Precision Ltd',
        contact_person: 'Rajesh Sharma',
        email: supplierEmail,
        phone: '+919988776655',
        address: 'Plot 42, Peenya Industrial Area, Phase 2',
        country: 'India',
        website: 'https://aerofast.example.com',
        status: 'active',
      })
      .select()
      .single();

    if (supRecordErr) throw supRecordErr;
    supplierRecord = createdSup;
  }
  console.log('✓ Supplier active:', supplierRecord.company_name, `(ID: ${supplierRecord.id})`);

  // 4. Seed Demo Customer
  console.log('\n4. Seeding Demo Customer Account...');
  const customerEmail = 'procurement@nexusaero.com';
  const customerPassword = 'Password@123456';

  let customerUserId = null;
  const existingCustomerUser = userList?.users?.find(u => u.email === customerEmail);
  if (existingCustomerUser) {
    customerUserId = existingCustomerUser.id;
  } else {
    const { data: createdCustomer, error: custCreateErr } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: customerPassword,
      email_confirm: true,
      user_metadata: { role: 'customer', full_name: 'Nexus Aerospace Procurement' },
    });
    if (custCreateErr) throw custCreateErr;
    customerUserId = createdCustomer.user.id;
  }

  const { data: customerProfile, error: custProfErr } = await supabase
    .from('profiles')
    .upsert({
      user_id: customerUserId,
      role: 'customer',
      full_name: 'Nexus Aerospace Procurement',
      email: customerEmail,
      phone: '+918877665544',
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (custProfErr) throw custProfErr;

  // Add delivery address
  const { data: existingAddr } = await supabase
    .from('customer_addresses')
    .select('id')
    .eq('customer_id', customerProfile.id)
    .maybeSingle();

  if (!existingAddr) {
    await supabase.from('customer_addresses').insert({
      customer_id: customerProfile.id,
      address_line_1: 'Building 7, Aerospace SEZ',
      address_line_2: 'Devanahalli High-Tech Park',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '562110',
      country: 'India',
    });
  }
  console.log('✓ Customer Profile & Address active:', customerProfile.email);

  // 5. Seed Catalog Products
  console.log('\n5. Seeding Product Catalog with Specs & Pricing...');
  const productsToSeed = [
    {
      name: 'Aerospace Grade Titanium Fastener M8x50',
      category: 'Industrial Fasteners',
      supplier_price: 450,
      profit_type: 'percentage',
      profit_value: 20,
      selling_price: 540,
      moq: 100,
      description: 'High-tensile Grade 5 Titanium (Ti-6Al-4V) hexagon socket head cap screw designed for extreme vibration resistance.',
      gst_rate: 18,
      gst_included: false,
      ribbon_label: 'Best Seller',
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      specs: [
        { spec_name: 'Material', spec_value: 'Titanium Grade 5 (Ti-6Al-4V)' },
        { spec_name: 'Tensile Strength', spec_value: '950 MPa minimum' },
        { spec_name: 'Thread Size', spec_value: 'M8 x 1.25 Pitch' },
        { spec_name: 'Length', spec_value: '50 mm' },
        { spec_name: 'Standard', spec_value: 'DIN 912 / ISO 4762' },
      ],
      images: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      ],
    },
    {
      name: '5-Axis Precision CNC Machined Rotor Hub',
      category: 'Precision CNC Components',
      supplier_price: 18500,
      profit_type: 'percentage',
      profit_value: 15,
      selling_price: 21275,
      moq: 10,
      description: 'Single-billet machined aluminum 7075-T6 rotor hub with hard anodized mil-spec surface finish.',
      gst_rate: 18,
      gst_included: false,
      ribbon_label: 'Featured',
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      specs: [
        { spec_name: 'Material', spec_value: 'Aluminum 7075-T6' },
        { spec_name: 'Tolerance', spec_value: '±0.005 mm' },
        { spec_name: 'Surface Finish', spec_value: 'MIL-A-8625 Type III Hard Anodize' },
        { spec_name: 'Weight', spec_value: '840 grams' },
      ],
      images: [
        'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
      ],
    },
    {
      name: 'High-Pressure Stainless Quick-Connect Coupler 1/2"',
      category: 'Hydraulic & Pneumatic Fittings',
      supplier_price: 3200,
      profit_type: 'fixed',
      profit_value: 600,
      selling_price: 3800,
      moq: 25,
      description: 'Double shut-off hydraulic quick disconnect coupling rated for 350 bar continuous operating pressure.',
      gst_rate: 18,
      gst_included: false,
      ribbon_label: 'New',
      approval_status: 'approved',
      publication_status: 'published',
      archive_status: 'active',
      specs: [
        { spec_name: 'Body Material', spec_value: 'AISI 316L Stainless Steel' },
        { spec_name: 'Max Pressure', spec_value: '350 Bar (5,000 PSI)' },
        { spec_name: 'Seal Material', spec_value: 'Fluoroelastomer (FKM / Viton)' },
        { spec_name: 'Connection', spec_value: '1/2" NPT Female' },
      ],
      images: [
        'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
      ],
    },
  ];

  for (const p of productsToSeed) {
    const categoryId = categoryMap[p.category];
    const { data: existingProd } = await supabase
      .from('products')
      .select('id')
      .eq('name', p.name)
      .maybeSingle();

    if (!existingProd) {
      const { data: prod, error } = await supabase
        .from('products')
        .insert({
          supplier_id: supplierRecord.id,
          category_id: categoryId,
          name: p.name,
          description: p.description,
          moq: p.moq,
          supplier_price: p.supplier_price,
          profit_type: p.profit_type,
          profit_value: p.profit_value,
          selling_price: p.selling_price,
          discount: 0,
          gst_rate: p.gst_rate,
          gst_included: p.gst_included,
          ribbon_label: p.ribbon_label,
          approval_status: p.approval_status,
          publication_status: p.publication_status,
          archive_status: p.archive_status,
        })
        .select()
        .single();

      if (error) throw error;

      // Add specs
      const specRows = p.specs.map((s, idx) => ({
        product_id: prod.id,
        spec_name: s.spec_name,
        spec_value: s.spec_value,
        sort_order: idx,
      }));
      await supabase.from('product_specifications').insert(specRows);

      // Add image
      const imgRows = p.images.map((url, idx) => ({
        product_id: prod.id,
        image_url: url,
        sort_order: idx,
        is_primary: idx === 0,
      }));
      await supabase.from('product_images').insert(imgRows);

      console.log(`✓ Product: ${prod.name} (Selling Price: ₹${prod.selling_price}, MOQ: ${prod.moq})`);
    } else {
      console.log(`✓ Product already exists: ${p.name}`);
    }
  }

  console.log('\n====================================================');
  console.log('Database Seeding Completed Successfully!');
  console.log('====================================================\n');
}

seedDatabase().catch(console.error);
