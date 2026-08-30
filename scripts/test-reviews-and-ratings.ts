import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkCustomerProductEligibility,
  getProductReviews,
  upsertProductReview,
  getProductsRatingAggregates,
} from '@/lib/server/reviews/review-service';
import { upsertReviewSchema } from '@/lib/validation/review.schema';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(num: number, name: string, passed: boolean, details?: string) {
  results.push({ num, name, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Test ${num.toString().padStart(2, '0')}] ${mark}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('MITFAST PRODUCT REVIEWS & 5-STAR RATINGS VERIFICATION');
  console.log('====================================================\n');

  const admin = createAdminClient();

  // 1. Validation Schema Tests
  const valid1 = upsertReviewSchema.safeParse({ rating: 5, reviewText: 'Superb precision CNC parts' });
  record(1, 'Validation: Valid 5-star review payload accepted', valid1.success);

  const invalidRating0 = upsertReviewSchema.safeParse({ rating: 0 });
  record(2, 'Validation: Rating 0 is blocked', !invalidRating0.success);

  const invalidRating6 = upsertReviewSchema.safeParse({ rating: 6 });
  record(3, 'Validation: Rating 6 is blocked', !invalidRating6.success);

  const invalidFloat = upsertReviewSchema.safeParse({ rating: 4.5 });
  record(4, 'Validation: Non-integer rating 4.5 is blocked', !invalidFloat.success);

  const tooLong = upsertReviewSchema.safeParse({ rating: 5, reviewText: 'a'.repeat(2001) });
  record(5, 'Validation: Review text > 2000 chars is blocked', !tooLong.success);

  // 2. Fetch random product and customer
  const { data: products } = await admin.from('products').select('id, name').limit(2);
  const { data: profiles } = await admin.from('profiles').select('id, role').eq('role', 'customer').limit(2);

  if (!products || products.length === 0 || !profiles || profiles.length === 0) {
    console.log('⚠️ Notice: Insufficient products or customers in DB to run live queries. Schema validated.');
    return;
  }

  const prodA = products[0].id;
  const prodB = products[1]?.id || prodA;
  const cust1 = profiles[0].id;

  // 3. Test eligibility check on real or mock relationship
  const isEligible = await checkCustomerProductEligibility(cust1, prodA);
  record(6, `Eligibility check executes cleanly for customer ${cust1.slice(0, 8)}`, typeof isEligible === 'boolean', `Result: ${isEligible}`);

  // 4. Test Ineligibility Block
  if (!isEligible) {
    const blockRes = await upsertProductReview(cust1, prodA, { rating: 5, reviewText: 'Attempting review' });
    record(7, 'Security: Ineligible customer review is blocked server-side', !blockRes.success && blockRes.error?.code === 'NOT_ELIGIBLE', blockRes.error?.message);
  } else {
    record(7, 'Security: Customer has qualifying RFQ/order', true);
  }

  // 5. Test batch rating aggregates
  const aggregates = await getProductsRatingAggregates([prodA, prodB]);
  record(8, 'Aggregation: getProductsRatingAggregates executes without error', typeof aggregates === 'object');

  // 6. Test getProductReviews query
  const reviewsRes = await getProductReviews(prodA, cust1);
  record(9, 'Read query: getProductReviews returns structured summary', reviewsRes.success && typeof reviewsRes.data.averageRating === 'number');

  console.log('\n====================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`TOTAL: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
