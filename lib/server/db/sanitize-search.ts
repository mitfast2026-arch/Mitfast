/**
 * Sanitize user search input for PostgREST filter strings and ILIKE patterns.
 * Prevents filter-logic abuse via commas/parens and accidental wildcard expansion.
 */

/** Escape characters that break or broaden PostgREST `.or()` filter strings. */
export function sanitizePostgrestSearch(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, ' ')
    .replace(/\(/g, ' ')
    .replace(/\)/g, ' ')
    .replace(/\./g, ' ')
    .trim();
}

/** Escape ILIKE wildcards when the value is passed as a bound pattern (not in `.or()`). */
export function sanitizeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
