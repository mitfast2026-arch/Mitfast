import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'span',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'blockquote',
  'code',
  'pre',
  'hr',
  'sub',
  'sup',
];

const ALLOWED_ATTR = ['style', 'class', 'colspan', 'rowspan', 'align', 'valign'];

export function sanitizeRichTextHtml(html: string): string {
  if (!html?.trim()) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function stripRichTextHtml(html: string): string {
  if (!html?.trim()) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}
