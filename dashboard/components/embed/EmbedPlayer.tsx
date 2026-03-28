'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function EmbedPlayer({
  signedUrl,
  recordingId,
  recordingName,
}: {
  signedUrl: string;
  recordingId: string;
  recordingName: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const viewLoggedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordedSize, setRecordedSize] = useState<{ width: number; height: number } | null>(null);

  // Log view on mount (once)
  useEffect(() => {
    if (viewLoggedRef.current) return;
    viewLoggedRef.current = true;

    fetch('/api/analytics/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording_id: recordingId }),
    }).catch(() => {
      // Analytics failure is non-blocking
    });
  }, [recordingId]);

  const initPlayer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Failed to load recording');
      const data = await res.json();

      const events = data.events;
      if (!events || events.length === 0) {
        setError('Recording has no events');
        setLoading(false);
        return;
      }

      const width = data.viewport?.width || 1280;
      const height = data.viewport?.height || 720;
      setRecordedSize({ width, height });

      const { default: rrwebPlayer } = await import('rrweb-player');
      await import('rrweb-player/dist/style.css');

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      const player = new rrwebPlayer({
        target: containerRef.current,
        props: {
          events,
          width,
          height,
          autoPlay: true,
          showController: true,
          speedOption: [0.5, 1, 2],
        },
      });

      playerRef.current = player;
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo');
      setLoading(false);
    }
  }, [signedUrl]);

  useEffect(() => {
    let cancelled = false;

    initPlayer().then(() => {
      if (cancelled) {
        if (playerRef.current && typeof (playerRef.current as Record<string, unknown>)['$destroy'] === 'function') {
          (playerRef.current as { $destroy: () => void }).$destroy();
        }
      }
    });

    return () => {
      cancelled = true;
      if (playerRef.current && typeof (playerRef.current as Record<string, unknown>)['$destroy'] === 'function') {
        (playerRef.current as { $destroy: () => void }).$destroy();
      }
    };
  }, [initPlayer]);

  // Responsive scaling
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!recordedSize || !wrapperRef.current) return;

    function updateScale() {
      if (!wrapperRef.current || !recordedSize) return;
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      // Leave 40px for the footer
      const availableHeight = wrapperRect.height - 40;
      const availableWidth = wrapperRect.width;

      const scaleX = availableWidth / recordedSize.width;
      const scaleY = availableHeight / recordedSize.height;
      setScale(Math.min(scaleX, scaleY, 1));
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [recordedSize]);

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => initPlayer()}
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
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-3 text-sm text-gray-500">Loading demo...</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={loading ? 'hidden' : ''}
          style={{
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-gray-100 px-4">
        <span className="text-xs text-gray-400 truncate mr-2">{recordingName}</span>
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
