const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupBuckets() {
  console.log('Initializing Supabase Storage buckets...');
  
  const buckets = [
    { name: 'product-images', public: true },
    { name: 'compliance-docs', public: false },
    { name: 'business-assets', public: true }
  ];

  for (const b of buckets) {
    const { data, error } = await supabase.storage.createBucket(b.name, {
      public: b.public,
      fileSizeLimit: 10485760, // 10MB
    });

    if (error) {
      if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
        console.log(`✓ Bucket "${b.name}" already exists.`);
      } else {
        console.warn(`! Bucket "${b.name}":`, error.message);
      }
    } else {
      console.log(`✓ Created bucket "${b.name}" (public: ${b.public})`);
    }
  }
}

setupBuckets().catch(console.error);
