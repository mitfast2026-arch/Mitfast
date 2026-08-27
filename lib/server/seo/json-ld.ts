/** Serialize JSON-LD for inline script tags without breaking out of </script>. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
