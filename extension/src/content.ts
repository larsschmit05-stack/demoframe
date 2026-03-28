import { record } from 'rrweb';
import type { eventWithTime, recordOptions } from 'rrweb';
import { generateSelector } from './utils/selector-generator';
import { SizeGuard } from './utils/size-guard';
import { buildRecording } from './utils/recording-format';
import type { InteractiveElement } from './utils/recording-format';

// ── Types ──────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'paused';

interface Message {
  type: string;
  [key: string]: unknown;
}

// ── Element Detector ───────────────────────────────────────────────

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
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  start(): void {
    // Static scan
    const staticElements = document.querySelectorAll(INTERACTIVE_SELECTORS);
    staticElements.forEach((el) => {
      this.registerElement(el as HTMLElement, 'static-scan');
    });

    // Click listener (capture phase)
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      this.registerElement(target, 'click');

      // Walk up max 3 ancestors
      let ancestor: HTMLElement | null = target.parentElement;
      let depth = 0;
      while (ancestor && depth < 3) {
        this.registerElement(ancestor, 'click');
        ancestor = ancestor.parentElement;
        depth++;
      }
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  registerElement(el: HTMLElement, source: 'static-scan' | 'click'): void {
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
      source,
    });
  }

  classifyElement(el: HTMLElement): InteractiveElement['type'] {
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
    if (role === 'tab' || role === 'menuitem') return 'button';

    return 'other';
  }

  getDetectedElements(): InteractiveElement[] {
    return Array.from(this.elements.values());
  }

  getCount(): number {
    return this.elements.size;
  }

  stop(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }
}

// ── Recording Controller ───────────────────────────────────────────

let state: RecordingState = 'idle';
let events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;
let detector: ElementDetector | null = null;
let port: chrome.runtime.Port | null = null;
let sizeGuard: SizeGuard | null = null;

function connectPort(): void {
  port = chrome.runtime.connect({ name: 'demoframe-content' });
  port.onDisconnect.addListener(() => {
    port = null;
  });
}

function sendStatus(): void {
  const msg = {
    type: 'STATUS_UPDATE',
    state,
    eventCount: events.length,
    elementCount: detector?.getCount() ?? 0,
    estimatedSize: sizeGuard?.getEstimatedSize() ?? 0,
  };

  // Send via port if available, otherwise try runtime
  if (port) {
    try {
      port.postMessage(msg);
    } catch {
      port = null;
    }
  }
}

function initRecording(): void {
  if (state === 'recording') return;

  events = [];
  detector = new ElementDetector();
  detector.start();

  sizeGuard = new SizeGuard((action, sizeBytes) => {
    if (action === 'warn') {
      sendPortMessage({
        type: 'SIZE_WARNING',
        sizeBytes,
      });
    } else if (action === 'stop') {
      sendPortMessage({
        type: 'SIZE_LIMIT_REACHED',
        sizeBytes,
      });
      stopRecording();
    }
  });

  connectPort();

  const rrwebConfig: Partial<recordOptions<eventWithTime>> = {
    checkoutEveryNms: 30000,
    maskAllInputs: false,
    blockClass: 'demoframe-block',
    recordCanvas: false,
    inlineImages: true,
    emit(event: eventWithTime) {
      if (!sizeGuard) return;
      const shouldContinue = sizeGuard.addEvent(event);
      if (!shouldContinue) return;

      events.push(event);
      sendStatus();
    },
  };

  stopFn = record(rrwebConfig) ?? null;
  state = 'recording';
  sendStatus();
}

function pauseRecording(): void {
  if (state !== 'recording' || !stopFn) return;

  stopFn();
  stopFn = null;
  state = 'paused';
  sendStatus();
}

function resumeRecording(): void {
  if (state !== 'paused') return;

  const rrwebConfig: Partial<recordOptions<eventWithTime>> = {
    checkoutEveryNms: 30000,
    maskAllInputs: false,
    blockClass: 'demoframe-block',
    recordCanvas: false,
    inlineImages: true,
    emit(event: eventWithTime) {
      if (!sizeGuard) return;
      const shouldContinue = sizeGuard.addEvent(event);
      if (!shouldContinue) return;

      events.push(event);
      sendStatus();
    },
  };

  stopFn = record(rrwebConfig) ?? null;
  state = 'recording';
  sendStatus();
}

function stopRecording(): void {
  if (state === 'idle') return;

  if (stopFn) {
    stopFn();
    stopFn = null;
  }

  const detectedElements = detector?.getDetectedElements() ?? [];
  detector?.stop();
  detector = null;

  const recording = buildRecording(
    events,
    detectedElements,
    window.location.href,
    document.title,
  );

  // Send recording to background
  sendPortMessage({
    type: 'RECORDING_COMPLETE',
    recording,
  });

  state = 'idle';
  events = [];
  sizeGuard?.reset();
  sizeGuard = null;
  sendStatus();
}

function sendPortMessage(msg: Message): void {
  if (port) {
    try {
      port.postMessage(msg);
    } catch {
      port = null;
    }
  }
}

// ── Message Listener ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    switch (message.type) {
      case 'START_RECORDING':
        initRecording();
        sendResponse({ ok: true });
        break;

      case 'PAUSE_RECORDING':
        pauseRecording();
        sendResponse({ ok: true });
        break;

      case 'RESUME_RECORDING':
        resumeRecording();
        sendResponse({ ok: true });
        break;

      case 'STOP_RECORDING':
        stopRecording();
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          ok: true,
          state,
          eventCount: events.length,
          elementCount: detector?.getCount() ?? 0,
        });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }

    // Return true to indicate async response
    return true;
  },
);

// ── Dashboard Integration ──────────────────────────────────────────
// Listen for messages from dashboard window.postMessage API
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  if (event.data.type === 'DEMOFRAME_SEND_TOKEN' && event.data.token) {
    // Store token in extension storage
    chrome.runtime.sendMessage(
      {
        type: 'SET_AUTH_TOKEN',
        token: event.data.token,
      },
      () => {
        // Send confirmation back to dashboard
        window.postMessage(
          {
            type: 'DEMOFRAME_TOKEN_STORED',
            ok: true,
          },
          '*'
        );
      }
    );
  }
});

// Signal that content script is loaded
console.log('[Demoframe] Content script loaded');
