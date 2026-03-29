/**
 * DOM Snapshot Capture Engine
 *
 * Captures a complete, self-contained HTML snapshot of the current page:
 * 1. Full rendered DOM
 * 2. All stylesheets inlined as <style> blocks
 * 3. All images inlined as data URIs
 * 4. Fonts inlined as base64 data URIs
 * 5. Form state serialized into HTML attributes
 * 6. Canvas elements converted to <img>
 * 7. All <script> tags stripped (CSS-only interactivity for MVP)
 */

export interface CaptureProgress {
  phase: 'dom' | 'stylesheets' | 'images' | 'fonts' | 'forms' | 'canvas' | 'cleanup' | 'done';
  detail?: string;
}

export type ProgressCallback = (progress: CaptureProgress) => void;

// ── Main capture function ─────────────────────────────────────────

export async function captureSnapshot(
  onProgress?: ProgressCallback
): Promise<string> {
  const report = (phase: CaptureProgress['phase'], detail?: string) =>
    onProgress?.({ phase, detail });

  // 1. Clone the full DOM
  report('dom', 'Cloning DOM tree');
  const docClone = document.documentElement.cloneNode(true) as HTMLElement;

  // 2. Inline stylesheets
  report('stylesheets', 'Inlining CSS');
  await inlineStylesheets(docClone);

  // 3. Inline images
  report('images', 'Inlining images');
  await inlineImages(docClone);

  // 4. Inline fonts referenced in CSS
  report('fonts', 'Inlining fonts');
  await inlineFontsInStyles(docClone);

  // 5. Serialize form state
  report('forms', 'Capturing form state');
  serializeFormState(docClone);

  // 6. Convert canvas elements
  report('canvas', 'Converting canvas elements');
  convertCanvasElements(docClone);

  // 7. Strip scripts and cleanup
  report('cleanup', 'Removing scripts');
  stripScripts(docClone);
  cleanupMeta(docClone);

  // 8. Build final HTML string
  report('done');
  const doctype = '<!DOCTYPE html>';
  return `${doctype}\n${docClone.outerHTML}`;
}

// ── Inline Stylesheets ────────────────────────────────────────────

async function inlineStylesheets(root: HTMLElement): Promise<void> {
  // Collect CSS from document.styleSheets (reads from the live page, not the clone)
  const cssTexts: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      // Try reading rules directly (same-origin sheets)
      const rules = Array.from(sheet.cssRules);
      const cssText = rules.map((r) => r.cssText).join('\n');
      cssTexts.push(cssText);
    } catch {
      // Cross-origin sheet — fetch it
      if (sheet.href) {
        try {
          const response = await fetch(sheet.href);
          if (response.ok) {
            let cssText = await response.text();
            // Resolve relative url() references to absolute
            cssText = resolveRelativeUrls(cssText, sheet.href);
            cssTexts.push(cssText);
          }
        } catch {
          // Skip sheets that can't be fetched
        }
      }
    }
  }

  // Also collect inline <style> content from the live document
  const liveStyles = document.querySelectorAll('style');
  liveStyles.forEach((style) => {
    cssTexts.push(style.textContent || '');
  });

  // Remove all existing <link rel="stylesheet"> and <style> from clone
  const cloneHead = root.querySelector('head');
  if (cloneHead) {
    cloneHead
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((el) => el.remove());
  }

  // Also remove <style> tags from body in clone
  root.querySelectorAll('body style').forEach((el) => el.remove());

  // Inject single consolidated <style> block
  if (cssTexts.length > 0 && cloneHead) {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-demoframe', 'captured-styles');
    styleEl.textContent = cssTexts.join('\n');
    cloneHead.appendChild(styleEl);
  }
}

function resolveRelativeUrls(css: string, baseUrl: string): string {
  return css.replace(/url\(\s*['"]?(?!data:)(?!https?:)(?!\/\/)([^'")]+)['"]?\s*\)/g,
    (_match, relPath: string) => {
      try {
        const absolute = new URL(relPath, baseUrl).href;
        return `url("${absolute}")`;
      } catch {
        return _match;
      }
    }
  );
}

// ── Inline Images ─────────────────────────────────────────────────

async function inlineImages(root: HTMLElement): Promise<void> {
  const images = root.querySelectorAll('img');
  const liveImages = document.querySelectorAll('img');

  const promises = Array.from(images).map(async (clonedImg, index) => {
    const liveImg = liveImages[index] as HTMLImageElement | undefined;
    if (!liveImg) return;

    const src = liveImg.src;
    if (!src || src.startsWith('data:')) return;

    try {
      const dataUri = await imageToDataUri(liveImg, src);
      if (dataUri) {
        clonedImg.setAttribute('src', dataUri);
        clonedImg.removeAttribute('srcset');
        clonedImg.removeAttribute('loading');
      }
    } catch {
      // Leave original src as fallback
    }
  });

  await Promise.all(promises);

  // Handle <picture> sources — just remove them, the <img> fallback is already inlined
  root.querySelectorAll('picture source').forEach((el) => el.remove());
}

async function imageToDataUri(
  liveImg: HTMLImageElement,
  src: string
): Promise<string | null> {
  // Try canvas approach first (works for same-origin and CORS-enabled images)
  try {
    if (liveImg.complete && liveImg.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = liveImg.naturalWidth;
      canvas.height = liveImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(liveImg, 0, 0);
        return canvas.toDataURL('image/png');
      }
    }
  } catch {
    // Canvas tainted — fall through to fetch approach
  }

  // Fetch approach (works for cross-origin via extension permissions)
  try {
    const response = await fetch(src);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Inline Fonts in Styles ────────────────────────────────────────

async function inlineFontsInStyles(root: HTMLElement): Promise<void> {
  const styles = root.querySelectorAll('style[data-demoframe="captured-styles"]');

  for (const style of Array.from(styles)) {
    let cssText = style.textContent || '';

    // Find all url() references in @font-face rules that aren't data URIs
    const fontUrlRegex = /@font-face\s*\{[^}]*url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)[^}]*\}/g;
    const fontUrls = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = fontUrlRegex.exec(cssText)) !== null) {
      fontUrls.add(match[1]);
    }

    // Fetch and inline each font URL
    for (const fontUrl of fontUrls) {
      try {
        const response = await fetch(fontUrl);
        if (!response.ok) continue;

        const blob = await response.blob();
        const dataUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(fontUrl); // fallback to original
          reader.readAsDataURL(blob);
        });

        // Replace all occurrences of this URL
        cssText = cssText.split(fontUrl).join(dataUri);
      } catch {
        // Leave original URL
      }
    }

    style.textContent = cssText;
  }
}

// ── Serialize Form State ──────────────────────────────────────────

function serializeFormState(root: HTMLElement): void {
  // Map cloned elements to their live counterparts by index
  const clonedInputs = root.querySelectorAll('input, textarea, select');
  const liveInputs = document.querySelectorAll('input, textarea, select');

  clonedInputs.forEach((clonedEl, index) => {
    const liveEl = liveInputs[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    if (!liveEl) return;

    if (liveEl instanceof HTMLInputElement) {
      if (liveEl.type === 'checkbox' || liveEl.type === 'radio') {
        if (liveEl.checked) {
          (clonedEl as HTMLInputElement).setAttribute('checked', '');
        } else {
          (clonedEl as HTMLInputElement).removeAttribute('checked');
        }
      } else {
        (clonedEl as HTMLInputElement).setAttribute('value', liveEl.value);
      }
    } else if (liveEl instanceof HTMLTextAreaElement) {
      clonedEl.textContent = liveEl.value;
    } else if (liveEl instanceof HTMLSelectElement) {
      const clonedOptions = clonedEl.querySelectorAll('option');
      const liveOptions = liveEl.querySelectorAll('option');
      clonedOptions.forEach((opt, optIndex) => {
        const liveOpt = liveOptions[optIndex] as HTMLOptionElement | undefined;
        if (liveOpt?.selected) {
          opt.setAttribute('selected', '');
        } else {
          opt.removeAttribute('selected');
        }
      });
    }
  });

  // Capture contenteditable elements
  const clonedEditables = root.querySelectorAll('[contenteditable="true"]');
  const liveEditables = document.querySelectorAll('[contenteditable="true"]');
  clonedEditables.forEach((clonedEl, index) => {
    const liveEl = liveEditables[index];
    if (liveEl) {
      clonedEl.innerHTML = liveEl.innerHTML;
    }
  });
}

// ── Convert Canvas Elements ───────────────────────────────────────

function convertCanvasElements(root: HTMLElement): void {
  const clonedCanvases = root.querySelectorAll('canvas');
  const liveCanvases = document.querySelectorAll('canvas');

  clonedCanvases.forEach((clonedCanvas, index) => {
    const liveCanvas = liveCanvases[index] as HTMLCanvasElement | undefined;
    if (!liveCanvas) return;

    try {
      const dataUrl = liveCanvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.width = liveCanvas.width;
      img.height = liveCanvas.height;
      img.style.cssText = clonedCanvas.style.cssText;
      img.className = clonedCanvas.className;
      clonedCanvas.replaceWith(img);
    } catch {
      // Canvas tainted, leave as-is
    }
  });
}

// ── Strip Scripts ─────────────────────────────────────────────────

function stripScripts(root: HTMLElement): void {
  // Remove all <script> tags
  root.querySelectorAll('script').forEach((el) => el.remove());

  // Remove all <noscript> tags (they show fallback content we don't want)
  root.querySelectorAll('noscript').forEach((el) => el.remove());

  // Remove inline event handlers
  const allElements = root.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

// ── Cleanup ───────────────────────────────────────────────────────

function cleanupMeta(root: HTMLElement): void {
  const head = root.querySelector('head');
  if (!head) return;

  // Remove preload/prefetch links (not needed in snapshot)
  head
    .querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"]')
    .forEach((el) => el.remove());

  // Remove CSP meta tags (would block our inline styles)
  head
    .querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
    .forEach((el) => el.remove());

  // Add a meta tag marking this as a DemoFrame snapshot
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'demoframe-snapshot');
  meta.setAttribute('content', new Date().toISOString());
  head.appendChild(meta);
}
