import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ul',
  'ol',
  'li',
  'span',
  'blockquote',
  'code',
  'pre',
  'a',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'sub',
  'sup',
  'mark',
  'div',
];

const ALLOWED_ATTR = [
  'style',
  'class',
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'loading',
  'colspan',
  'rowspan',
  'align',
  'valign',
  'data-text-align',
  'data-font-size',
];

const ALLOWED_URI_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Check if rich text content is essentially empty (empty tags, whitespace, placeholder HTML).
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

/**
 * Sanitize rich text HTML safely on server and client.
 * Preserves ecommerce formatting, tables, headings, links, and inline images while stripping XSS vectors.
 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html?.trim() || isEmptyRichText(html)) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
  });
}

/**
 * Strip all HTML tags for plain-text search, previews, or card snippets.
 */
export function stripRichTextHtml(html: string): string {
  if (!html?.trim()) return '';
  const spaced = html
    .replace(/<\/(h[1-6]|p|div|li|tr|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  const cleaned = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [] });
  return cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
