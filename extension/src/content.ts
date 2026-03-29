import { generateSelector } from './utils/selector-generator';
import { captureSnapshot } from './utils/snapshot-capture';
import type { InteractiveElement, ScreenSnapshot } from './utils/recording-format';

// ── Types ──────────────────────────────────────────────────────────

interface Message {
  type: string;
  [key: string]: unknown;
}

// ── Interactive Element Detector ──────────────────────────────────

const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
  'label[for]',
].join(', ');

class ElementDetector {
  private elements = new Map<string, InteractiveElement>();

  scan(): void {
    const elements = document.querySelectorAll(INTERACTIVE_SELECTORS);
    elements.forEach((el) => {
      this.registerElement(el as HTMLElement);
    });
  }

  private registerElement(el: HTMLElement): void {
    const selector = generateSelector(el);
    if (this.elements.has(selector)) return;

    const rect = el.getBoundingClientRect();

    this.elements.set(selector, {
      selector,
      tag: el.tagName.toLowerCase(),
      type: this.classifyElement(el),
      text: (el.textContent || '').trim().slice(0, 100),
      rect: rect.width > 0 && rect.height > 0
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null,
    });
  }

  private classifyElement(el: HTMLElement): InteractiveElement['type'] {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'a' || role === 'link') return 'link';
    if (tag === 'select') return 'select';
    if (tag === 'input') {
      const inputType = (el as HTMLInputElement).type;
      if (inputType === 'checkbox' || inputType === 'radio') return 'toggle';
      return 'input';
    }
    if (tag === 'textarea') return 'input';
    if (role === 'checkbox' || role === 'radio') return 'toggle';
    if (role === 'tab') return 'tab';
    if (role === 'menuitem') return 'button';

    return 'other';
  }

  getDetectedElements(): InteractiveElement[] {
    return Array.from(this.elements.values());
  }

  getCount(): number {
    return this.elements.size;
  }
}

// ── Capture Controller ────────────────────────────────────────────

let capturing = false;

async function captureCurrentScreen(): Promise<ScreenSnapshot | null> {
  if (capturing) return null;
  capturing = true;

  try {
    // Detect interactive elements
    const detector = new ElementDetector();
    detector.scan();

    // Capture DOM snapshot
    const html = await captureSnapshot((progress) => {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_PROGRESS',
        phase: progress.phase,
        detail: progress.detail,
      }).catch(() => {});
    });

    const sizeBytes = new Blob([html]).size;

    const snapshot: ScreenSnapshot = {
      name: document.title || 'Untitled Screen',
      sourceUrl: window.location.href,
      html,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      interactiveElements: detector.getDetectedElements(),
      capturedAt: new Date().toISOString(),
      sizeBytes,
    };

    return snapshot;
  } finally {
    capturing = false;
  }
}

// ── Message Listener ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    switch (message.type) {
      case 'CAPTURE_SCREEN':
        captureCurrentScreen().then((snapshot) => {
          if (snapshot) {
            sendResponse({ ok: true, snapshot });
          } else {
            sendResponse({ ok: false, error: 'Capture already in progress' });
          }
        }).catch((err) => {
          sendResponse({ ok: false, error: String(err) });
        });
        // Return true for async sendResponse
        return true;

      case 'GET_PAGE_INFO':
        sendResponse({
          ok: true,
          title: document.title,
          url: window.location.href,
        });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }

    return true;
  },
);

// ── Dashboard Integration ─────────────────────────────────────────
// Listen for auth token from dashboard window.postMessage API
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'DEMOFRAME_SEND_TOKEN' && event.data.token) {
    chrome.runtime.sendMessage(
      {
        type: 'SET_AUTH_TOKEN',
        token: event.data.token,
      },
      () => {
        window.postMessage(
          { type: 'DEMOFRAME_TOKEN_STORED', ok: true },
          '*'
        );
      }
    );
  }
});

console.log('[Demoframe] Content script loaded (snapshot capture mode)');
