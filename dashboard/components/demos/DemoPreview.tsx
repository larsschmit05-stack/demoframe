'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * DemoPreview — renders a single screen snapshot in Shadow DOM.
 * Used on the dashboard detail page for previewing captured screens.
 * Simpler than DemoPlayer: no navigation, no analytics, no footer.
 */
export default function DemoPreview({
  signedUrl,
  viewportWidth = 1280,
  viewportHeight = 720,
}: {
  signedUrl: string;
  viewportWidth?: number;
  viewportHeight?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const initPreview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Failed to load screen');
      const html = await res.text();

      if (!hostRef.current) return;

      // Create Shadow DOM
      if (!shadowRootRef.current) {
        shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
      }

      const shadow = shadowRootRef.current;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      shadow.innerHTML = '';

      // Inject styles
      const styles = doc.querySelectorAll('head style, head link[rel="stylesheet"]');
      styles.forEach((styleEl) => {
        shadow.appendChild(styleEl.cloneNode(true));
      });

      // Base style
      const baseStyle = document.createElement('style');
      baseStyle.textContent = `
        :host { display: block; overflow: hidden; }
        a { pointer-events: none; }
      `;
      shadow.appendChild(baseStyle);

      // Inject body content
      const body = doc.querySelector('body');
      if (body) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = body.innerHTML;
        Array.from(body.attributes).forEach((attr) => {
          if (attr.name !== 'class') {
            wrapper.setAttribute(attr.name, attr.value);
          }
        });
        if (body.className) wrapper.className = body.className;
        shadow.appendChild(wrapper);
      }

      // Block all clicks
      shadow.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
      setLoading(false);
    }
  }, [signedUrl]);

  useEffect(() => {
    initPreview();
  }, [initPreview]);

  // Responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;

    function updateScale() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = rect.width / viewportWidth;
      const scaleY = rect.height / viewportHeight;
      setScale(Math.min(scaleX, scaleY, 1));
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [viewportWidth, viewportHeight]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg border border-gray-200 bg-white" style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <p className="mt-3 text-sm text-gray-500">Loading preview...</p>
          </div>
        </div>
      )}
      <div
        ref={hostRef}
        className={loading ? 'hidden' : ''}
        style={{
          width: viewportWidth,
          height: viewportHeight,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
