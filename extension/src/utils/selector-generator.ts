/**
 * Generate a CSS selector for an element.
 * Priority: #id > [data-testid] > tag:nth-of-type path (max 3 ancestors)
 */
export function generateSelector(el: Element): string {
  // 1. ID selector
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  // 2. data-testid selector
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // 3. Build tag:nth-of-type path up to 3 ancestors
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < 4) {
    if (current === document.documentElement) break;

    const tag = current.tagName.toLowerCase();

    // If this ancestor has an id, use it as the root and stop
    if (current.id && depth > 0) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // If this ancestor has data-testid, use it as root
    const ancestorTestId = current.getAttribute('data-testid');
    if (ancestorTestId && depth > 0) {
      parts.unshift(`[data-testid="${CSS.escape(ancestorTestId)}"]`);
      break;
    }

    // Calculate nth-of-type index
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }

    current = parent;
    depth++;
  }

  return parts.join(' > ');
}
