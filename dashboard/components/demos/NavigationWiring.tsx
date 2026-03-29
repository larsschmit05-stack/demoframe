'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Screen, NavigationRule } from '@/lib/types';

interface ScreenWithUrl extends Screen {
  signed_url: string | null;
}

export default function NavigationWiring({
  demo,
  screens,
  initialRules,
}: {
  demo: { id: string; name: string };
  screens: ScreenWithUrl[];
  initialRules: NavigationRule[];
}) {
  const [rules, setRules] = useState<NavigationRule[]>(initialRules);
  const [sourceScreenId, setSourceScreenId] = useState<string>(
    screens[0]?.id ?? ''
  );
  const [wireMode, setWireMode] = useState(false);
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [targetScreenId, setTargetScreenId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const sourceScreen = screens.find((s) => s.id === sourceScreenId) ?? null;
  const sourceRules = rules.filter((r) => r.source_screen_id === sourceScreenId);

  // Render source screen in Shadow DOM
  const renderSourceScreen = useCallback(async () => {
    if (!sourceScreen?.signed_url || !hostRef.current) return;

    setScreenLoading(true);
    try {
      const res = await fetch(sourceScreen.signed_url);
      if (!res.ok) throw new Error('Failed to load screen');
      const html = await res.text();

      if (!shadowRootRef.current) {
        shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
      }

      const shadow = shadowRootRef.current;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      shadow.innerHTML = '';

      // Inject styles
      const styles = doc.querySelectorAll('head style, head link[rel="stylesheet"]');
      styles.forEach((el) => shadow.appendChild(el.cloneNode(true)));

      const baseStyle = document.createElement('style');
      baseStyle.textContent = `
        :host { display: block; overflow: auto; }
        [data-demoframe-highlight] {
          outline: 2px solid rgba(99, 102, 241, 0.7) !important;
          outline-offset: 2px !important;
          cursor: crosshair !important;
        }
      `;
      shadow.appendChild(baseStyle);

      // Inject body
      const body = doc.querySelector('body');
      if (body) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = body.innerHTML;
        Array.from(body.attributes).forEach((attr) => {
          if (attr.name !== 'class') wrapper.setAttribute(attr.name, attr.value);
        });
        if (body.className) wrapper.className = body.className;
        shadow.appendChild(wrapper);
      }

      // Block all default clicks
      shadow.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      setScreenLoading(false);
    } catch {
      setScreenLoading(false);
    }
  }, [sourceScreen]);

  useEffect(() => {
    renderSourceScreen();
  }, [renderSourceScreen]);

  // Wire mode: add hover highlights and click-to-select
  useEffect(() => {
    const shadow = shadowRootRef.current;
    if (!shadow || !wireMode) return;

    function handleMouseOver(e: Event) {
      const target = e.target as HTMLElement;
      if (target === (shadow as unknown as HTMLElement)) return;
      target.setAttribute('data-demoframe-highlight', '');
    }

    function handleMouseOut(e: Event) {
      const target = e.target as HTMLElement;
      target.removeAttribute('data-demoframe-highlight');
    }

    function handleClick(e: Event) {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      target.removeAttribute('data-demoframe-highlight');

      // Generate a reasonable CSS selector
      const selector = generateSelector(target, shadow!);
      const text = target.textContent?.trim().slice(0, 100) || null;

      setSelectedSelector(selector);
      setSelectedText(text);
    }

    shadow.addEventListener('mouseover', handleMouseOver);
    shadow.addEventListener('mouseout', handleMouseOut);
    shadow.addEventListener('click', handleClick);

    return () => {
      shadow.removeEventListener('mouseover', handleMouseOver);
      shadow.removeEventListener('mouseout', handleMouseOut);
      shadow.removeEventListener('click', handleClick);
    };
  }, [wireMode]);

  // Responsive scaling
  useEffect(() => {
    if (!sourceScreen || !containerRef.current) return;

    function updateScale() {
      if (!containerRef.current || !sourceScreen) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = rect.width / sourceScreen.viewport_width;
      const scaleY = rect.height / sourceScreen.viewport_height;
      setScale(Math.min(scaleX, scaleY, 1));
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [sourceScreen]);

  async function handleSaveRule() {
    if (!selectedSelector || !targetScreenId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/demos/${demo.id}/navigation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_screen_id: sourceScreenId,
          target_screen_id: targetScreenId,
          trigger_selector: selectedSelector,
          trigger_text: selectedText,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(data.error || 'Failed to save rule');
      }

      const rule: NavigationRule = await res.json();
      setRules((prev) => [...prev, rule]);
      setSelectedSelector(null);
      setSelectedText(null);
      setTargetScreenId('');
      setWireMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    const res = await fetch(
      `/api/demos/${demo.id}/navigation-rules?rule_id=${ruleId}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
  }

  if (screens.length < 2) {
    return (
      <div>
        <Link
          href={`/dashboard/demos/${demo.id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to {demo.name}
        </Link>
        <h1 className="text-2xl font-bold mb-4">Wire Navigation</h1>
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">
            You need at least 2 screens to create navigation rules.
            Capture more screens with the Chrome Extension.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <Link
        href={`/dashboard/demos/${demo.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to {demo.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Wire Navigation</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Screen preview */}
        <div className="col-span-2">
          {/* Source screen selector */}
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              Source Screen:
            </label>
            <select
              value={sourceScreenId}
              onChange={(e) => {
                setSourceScreenId(e.target.value);
                setSelectedSelector(null);
                setWireMode(false);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setWireMode(!wireMode);
                if (wireMode) {
                  setSelectedSelector(null);
                  setSelectedText(null);
                }
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                wireMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              {wireMode ? 'Cancel Wiring' : 'Click to Wire'}
            </button>
          </div>

          {wireMode && !selectedSelector && (
            <p className="mb-2 text-sm text-indigo-600">
              Click any element in the preview to select it as a navigation trigger.
            </p>
          )}

          {/* Screen preview */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-white"
            style={{
              aspectRatio: sourceScreen
                ? `${sourceScreen.viewport_width} / ${sourceScreen.viewport_height}`
                : '16 / 9',
            }}
          >
            {screenLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
              </div>
            )}
            <div
              ref={hostRef}
              className={screenLoading ? 'hidden' : ''}
              style={{
                width: sourceScreen?.viewport_width ?? 1280,
                height: sourceScreen?.viewport_height ?? 720,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }}
            />
          </div>

          {/* Selected element + target screen picker */}
          {selectedSelector && (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-medium text-indigo-900 mb-2">
                Selected Element
              </p>
              <p className="text-xs text-gray-700 font-mono mb-1">
                {selectedSelector}
              </p>
              {selectedText && (
                <p className="text-xs text-gray-500 mb-3">
                  Text: &quot;{selectedText.slice(0, 60)}
                  {selectedText.length > 60 ? '...' : ''}&quot;
                </p>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-indigo-900">
                  Navigate to:
                </label>
                <select
                  value={targetScreenId}
                  onChange={(e) => setTargetScreenId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select target screen...</option>
                  {screens
                    .filter((s) => s.id !== sourceScreenId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleSaveRule}
                  disabled={!targetScreenId || saving}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Rules list */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Navigation Rules ({sourceRules.length})
          </h2>
          {sourceRules.length === 0 ? (
            <p className="text-sm text-gray-500">
              No rules for this screen yet. Click &quot;Click to Wire&quot; to
              add one.
            </p>
          ) : (
            <div className="space-y-3">
              {sourceRules.map((rule) => {
                const targetScreen = screens.find(
                  (s) => s.id === rule.target_screen_id
                );
                return (
                  <div
                    key={rule.id}
                    className="rounded-md border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-mono text-gray-600">
                          {rule.trigger_selector}
                        </p>
                        {rule.trigger_text && (
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            &quot;{rule.trigger_text}&quot;
                          </p>
                        )}
                        <p className="mt-1 text-xs text-indigo-600">
                          &rarr; {targetScreen?.name ?? 'Unknown screen'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="ml-2 shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All rules across screens */}
          {rules.length > sourceRules.length && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                All Rules ({rules.length})
              </h3>
              <div className="space-y-2">
                {rules
                  .filter((r) => r.source_screen_id !== sourceScreenId)
                  .map((rule) => {
                    const src = screens.find(
                      (s) => s.id === rule.source_screen_id
                    );
                    const tgt = screens.find(
                      (s) => s.id === rule.target_screen_id
                    );
                    return (
                      <div
                        key={rule.id}
                        className="rounded-md border border-gray-100 bg-gray-50 p-2"
                      >
                        <p className="text-xs text-gray-500">
                          {src?.name ?? '?'} &rarr; {tgt?.name ?? '?'}
                        </p>
                        <p className="truncate text-xs font-mono text-gray-400">
                          {rule.trigger_selector}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a CSS selector for an element within a Shadow DOM.
 * Prefers: data-testid > id > tag with nth-child
 */
function generateSelector(el: HTMLElement, root: ShadowRoot): string {
  // data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // id
  if (el.id) return `#${el.id}`;

  // Build a path from the element up to the shadow root's first child
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== root.host) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}
