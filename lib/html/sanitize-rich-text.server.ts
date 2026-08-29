import 'server-only';
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
  'span',
];

const ALLOWED_ATTR = ['style', 'class'];

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
