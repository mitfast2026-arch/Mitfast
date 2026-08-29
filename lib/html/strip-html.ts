/** Client-safe HTML tag stripper (no DOMPurify / jsdom). */
export function stripHtmlTags(html: string): string {
  if (!html?.trim()) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
