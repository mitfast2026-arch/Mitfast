/**
 * Image reorder / replace logic smoke checks (pure functions).
 * Run: npx tsx scripts/image-regression-probe.ts
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function reorderUrls(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;
  const setA = new Set(current);
  const setB = new Set(next);
  if (setA.size !== setB.size) return false;
  for (const url of setA) {
    if (!setB.has(url)) return false;
  }
  return true;
}

const existing = ['a.webp', 'b.webp', 'c.webp'];
const reordered = ['c.webp', 'a.webp', 'b.webp'];
assert(reorderUrls(existing, reordered), 'reorder-only URL set is valid for in-place update');

const replaced = ['d.webp', 'a.webp', 'b.webp'];
assert(!reorderUrls(existing, replaced), 'URL set change detected for delete-first path');

const same = ['a.webp', 'b.webp', 'c.webp'];
assert(
  same.every((url, i) => url === existing[i]),
  'identical order is a no-op'
);

if (process.exitCode) {
  console.error('\nImage regression probe failed.');
} else {
  console.log('\nImage regression probe passed.');
}
