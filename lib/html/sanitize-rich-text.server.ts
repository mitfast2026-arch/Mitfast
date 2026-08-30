import sanitizeHtml from 'sanitize-html';
import { isEmptyRichText } from './rich-text-utils';

export { isEmptyRichText };

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

const ALLOWED_URI_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Sanitize rich text HTML safely on server and client.
 * Preserves ecommerce formatting, tables, headings, links, and inline images while stripping XSS vectors.
 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html?.trim() || isEmptyRichText(html)) return '';

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['style', 'class', 'title', 'data-text-align', 'data-font-size'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      table: ['align', 'valign'],
      th: ['colspan', 'rowspan', 'align', 'valign'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
    },
    allowedSchemes: ALLOWED_URI_SCHEMES,
    allowedSchemesByTag: {
      img: ['data', 'http', 'https'],
    },
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
  const cleaned = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
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
