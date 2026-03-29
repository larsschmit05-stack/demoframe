'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { EmbedPayload } from '@/lib/types';

interface NavigationRule {
  source_screen_id: string;
  target_screen_id: string;
  trigger_selector: string;
  trigger_text: string | null;
}

interface ScreenData {
  id: string;
  name: string;
  viewport_width: number;
  viewport_height: number;
  signed_url: string;
}

export default function DemoPlayer({
  demoId,
  demoName,
  apiUrl,
}: {
  demoId: string;
  demoName: string;
  apiUrl?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const viewLoggedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScreenName, setCurrentScreenName] = useState('');
  const [scale, setScale] = useState(1);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);

  // In-memory caches
  const screensRef = useRef<ScreenData[]>([]);
  const rulesRef = useRef<NavigationRule[]>([]);
  const htmlCacheRef = useRef<Map<string, string>>(new Map());
  const historyRef = useRef<string[]>([]);
  const currentScreenIdRef = useRef<string>('');

  // Log view on mount
  useEffect(() => {
    if (viewLoggedRef.current) return;
    viewLoggedRef.current = true;

    const base = apiUrl || '';
    fetch(`${base}/api/analytics/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo_id: demoId }),
    }).catch(() => {});
  }, [demoId, apiUrl]);

  // Fetch a screen's HTML content
  const fetchScreenHtml = useCallback(async (screen: ScreenData): Promise<string> => {
    const cached = htmlCacheRef.current.get(screen.id);
    if (cached) return cached;

    const res = await fetch(screen.signed_url);
    if (!res.ok) throw new Error(`Failed to load screen: ${screen.name}`);
    const html = await res.text();
    htmlCacheRef.current.set(screen.id, html);
    return html;
  }, []);

  // Render a screen into the Shadow DOM
  const renderScreen = useCallback(async (screenId: string) => {
    const shadow = shadowRootRef.current;
    if (!shadow) return;

    const screen = screensRef.current.find((s) => s.id === screenId);
    if (!screen) return;

    const html = await fetchScreenHtml(screen);

    // Parse the HTML to extract <head> styles and <body> content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Clear shadow root
    shadow.innerHTML = '';

    // Inject all <style> elements from <head>
    const styles = doc.querySelectorAll('head style, head link[rel="stylesheet"]');
    styles.forEach((styleEl) => {
      shadow.appendChild(styleEl.cloneNode(true));
    });

    // Add base styles for the shadow container
    const baseStyle = document.createElement('style');
    baseStyle.textContent = `
      :host {
        display: block;
        overflow: auto;
      }
      /* Prevent links from navigating away */
      a { cursor: pointer; }
    `;
    shadow.appendChild(baseStyle);

    // Inject <body> content
    const body = doc.querySelector('body');
    if (body) {
      // Create a wrapper div to hold body content
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-demoframe-body', '');
      wrapper.innerHTML = body.innerHTML;

      // Copy body attributes (class, style, etc.)
      Array.from(body.attributes).forEach((attr) => {
        if (attr.name !== 'class') {
          wrapper.setAttribute(attr.name, attr.value);
        }
      });
      if (body.className) {
        wrapper.className = body.className;
      }

      shadow.appendChild(wrapper);
    }

    // Attach navigation handlers
    attachNavigationHandlers(shadow, screenId);

    // Block all remaining link clicks from navigating away
    shadow.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Update state
    currentScreenIdRef.current = screenId;
    setCurrentScreenName(screen.name);
    setViewportSize({ width: screen.viewport_width, height: screen.viewport_height });
  }, [fetchScreenHtml]);

  // Attach click handlers for navigation rules
  const attachNavigationHandlers = useCallback((shadow: ShadowRoot, screenId: string) => {
    const rules = rulesRef.current.filter((r) => r.source_screen_id === screenId);

    rules.forEach((rule) => {
      const elements = shadow.querySelectorAll(rule.trigger_selector);
      elements.forEach((el) => {
        (el as HTMLElement).style.cursor = 'pointer';
        // Add a subtle highlight on hover
        (el as HTMLElement).style.transition = 'outline 0.15s ease';
        el.addEventListener('mouseenter', () => {
          (el as HTMLElement).style.outline = '2px solid rgba(99, 102, 241, 0.5)';
          (el as HTMLElement).style.outlineOffset = '2px';
        });
        el.addEventListener('mouseleave', () => {
          (el as HTMLElement).style.outline = 'none';
        });
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigateTo(rule.target_screen_id);
        });
      });
    });
  }, []);

  // Navigate to a screen
  const navigateTo = useCallback(async (screenId: string) => {
    // Push current to history
    if (currentScreenIdRef.current) {
      historyRef.current.push(currentScreenIdRef.current);
    }
    await renderScreen(screenId);
  }, [renderScreen]);

  // Go back in history
  const goBack = useCallback(async () => {
    const prevId = historyRef.current.pop();
    if (prevId) {
      await renderScreen(prevId);
    }
  }, [renderScreen]);

  // Initialize the player
  const initPlayer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const base = apiUrl || '';
      const res = await fetch(`${base}/api/embed/${demoId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to load demo' }));
        throw new Error(data.error || 'Failed to load demo');
      }

      const payload: EmbedPayload = await res.json();

      screensRef.current = payload.screens;
      rulesRef.current = payload.navigation_rules;

      // Create Shadow DOM
      if (hostRef.current && !shadowRootRef.current) {
        shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
      }

      // Prefetch all screen HTML in parallel
      await Promise.all(
        payload.screens.map((screen) => fetchScreenHtml(screen))
      );

      // Render the start screen
      await renderScreen(payload.start_screen_id);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo');
      setLoading(false);
    }
  }, [demoId, apiUrl, fetchScreenHtml, renderScreen]);

  useEffect(() => {
    initPlayer();
  }, [initPlayer]);

  // Responsive scaling
  useEffect(() => {
    if (!viewportSize || !wrapperRef.current) return;

    function updateScale() {
      if (!wrapperRef.current || !viewportSize) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const availableHeight = rect.height - 40; // footer height
      const availableWidth = rect.width;

      const scaleX = availableWidth / viewportSize.width;
      const scaleY = availableHeight / viewportSize.height;
      setScale(Math.min(scaleX, scaleY, 1));
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [viewportSize]);

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={initPlayer}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex h-screen w-screen flex-col bg-white">
      {/* Player area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {loading && (
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <p className="mt-3 text-sm text-gray-500">Loading demo...</p>
          </div>
        )}
        <div
          ref={hostRef}
          className={loading ? 'hidden' : ''}
          style={{
            width: viewportSize?.width ?? 1280,
            height: viewportSize?.height ?? 720,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            overflow: 'hidden',
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-gray-100 px-4">
        <div className="flex items-center gap-3">
          {historyRef.current.length > 0 && (
            <button
              onClick={goBack}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              <span>&larr;</span> Back
            </button>
          )}
          <span className="text-xs text-gray-400 truncate">{currentScreenName || demoName}</span>
        </div>
        <a
          href="https://demoframe.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          Powered by DemoFrame
        </a>
      </div>
    </div>
  );
}
