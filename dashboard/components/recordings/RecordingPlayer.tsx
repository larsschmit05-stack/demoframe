'use client';

import { useEffect, useRef, useState } from 'react';

export default function RecordingPlayer({
  signedUrl,
}: {
  signedUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error('Failed to load recording');
        const data = await res.json();

        if (cancelled || !containerRef.current) return;

        const events = data.events;
        if (!events || events.length === 0) {
          setError('Recording has no events');
          setLoading(false);
          return;
        }

        const { default: rrwebPlayer } = await import('rrweb-player');
        await import('rrweb-player/dist/style.css');

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        const player = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events,
            width: data.viewport?.width || 1280,
            height: data.viewport?.height || 720,
            autoPlay: false,
            showController: true,
            speedOption: [0.5, 1, 2, 4],
          },
        });

        playerRef.current = player;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load player');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (playerRef.current && typeof (playerRef.current as Record<string, unknown>)['$destroy'] === 'function') {
        (playerRef.current as { $destroy: () => void }).$destroy();
      }
    };
  }, [signedUrl]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-16">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-3 text-sm text-gray-500">Loading recording...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={`overflow-hidden rounded-lg border border-gray-200 ${loading ? 'hidden' : ''}`}
        style={{ maxWidth: '100%' }}
      />
    </div>
  );
}
