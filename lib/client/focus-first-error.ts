/** Field keys in validation order — first match wins for scroll/focus. */
const FIELD_FOCUS_ORDER = [
  'name',
  'categoryId',
  'description',
  'supplierPrice',
  'suggestedMoq',
  'moq',
  'profit',
  'gst',
  'discount',
  'specRows',
] as const;

const FIELD_SELECTORS: Record<string, string> = {
  name: '[data-field="name"]',
  categoryId: '[data-field="categoryId"]',
  description: '[data-field="description"]',
  supplierPrice: '[data-field="supplierPrice"]',
  suggestedMoq: '[data-field="suggestedMoq"]',
  moq: '[data-field="moq"]',
  profit: '[data-field="profit"]',
  gst: '[data-field="gst"]',
  discount: '[data-field="discount"]',
  specRows: '#section-specs',
};

function focusableWithin(el: HTMLElement): HTMLElement | null {
  const selector =
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], .ProseMirror';
  const found = el.querySelector<HTMLElement>(selector);
  if (found) return found;
  if (el.matches?.(selector)) return el;
  return null;
}

/**
 * Scroll to and focus the first invalid field in a form panel.
 * Call after setErrors — uses requestAnimationFrame so DOM can update.
 */
export function focusFirstFormError(
  errors: Record<string, string>,
  root?: HTMLElement | null
): void {
  const keys = Object.keys(errors);
  if (!keys.length) return;

  const orderedKey =
    FIELD_FOCUS_ORDER.find((k) => errors[k]) ?? keys[0];
  const selector = FIELD_SELECTORS[orderedKey] ?? `[data-field="${orderedKey}"]`;

  requestAnimationFrame(() => {
    const scope = root ?? document;
    const target = scope.querySelector<HTMLElement>(selector);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const sectionToggle = target.closest('section')?.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]'
    );
    sectionToggle?.click();

    requestAnimationFrame(() => {
      const focusEl = focusableWithin(target) ?? target;
      focusEl.focus?.({ preventScroll: true });
    });
  });
}

export function formatValidationSummary(errors: Record<string, string>): string {
  const messages = Object.values(errors).filter(Boolean);
  if (messages.length === 1) return messages[0];
  return `Please fix ${messages.length} fields before continuing.`;
}
