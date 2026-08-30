/**
 * Pure client- and server-safe utilities for rich text detection.
 * Does not import any node or heavy sanitization packages.
 */

export function isEmptyRichText(html?: string | null): boolean {
  if (!html || typeof html !== 'string') return true;
  const trimmed = html.trim();
  if (!trimmed) return true;

  // Check common empty TipTap patterns
  if (
    trimmed === '<p></p>' ||
    trimmed === '<p><br></p>' ||
    trimmed === '<p><br/></p>' ||
    trimmed === '<p>&nbsp;</p>' ||
    trimmed === '<div></div>' ||
    trimmed === '<p></p>\n'
  ) {
    return true;
  }

  // Strip all HTML tags and entities to check for actual printable content or non-empty media
  if (/<img\b[^>]*>/i.test(trimmed)) return false;
  if (/<table\b[^>]*>/i.test(trimmed)) return false;
  if (/<hr\b[^>]*>/i.test(trimmed)) return false;

  const textContent = trimmed
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .trim();

  return textContent.length === 0;
}
