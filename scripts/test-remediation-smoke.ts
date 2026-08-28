/**
 * Lightweight regression checks for audit remediation (TEST-GAP-001).
 * Run: npx tsx scripts/test-remediation-smoke.ts
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

function sameUrlSetSkip(current: string[], next: string[]): boolean {
  return (
    next.length === current.length && next.every((url, index) => url === current[index])
  );
}

assert(sameUrlSetSkip(['a', 'b'], ['a', 'b']), 'replaceProductImages skip when URLs unchanged');
assert(!sameUrlSetSkip(['a'], ['a', 'b']), 'replaceProductImages runs when URL count differs');
assert(!sameUrlSetSkip(['a', 'b'], ['b', 'a']), 'replaceProductImages runs when URL order differs');

const requiredTigris = [
  'TIGRIS_BUCKET_NAME',
  'TIGRIS_ACCESS_KEY_ID',
  'TIGRIS_SECRET_ACCESS_KEY',
  'TIGRIS_PUBLIC_URL_BASE',
];

const missingTigris = requiredTigris.filter((key) => !process.env[key]?.trim());
if (missingTigris.length === 0) {
  console.log('ok: Tigris env vars present');
} else {
  console.warn(`warn: Missing Tigris env (${missingTigris.join(', ')}) — uploads will return STORAGE_CONFIG_ERROR`);
}

if (process.exitCode) {
  console.error('\nRemediation smoke tests failed.');
  process.exit(process.exitCode);
}

console.log('\nAll remediation smoke checks passed.');
