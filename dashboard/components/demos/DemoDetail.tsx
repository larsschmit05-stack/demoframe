'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import DemoPreview from '@/components/demos/DemoPreview';
import type { Demo, Screen, NavigationRule } from '@/lib/types';

interface ScreenWithUrl extends Screen {
  signed_url: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DemoDetail({
  demo,
  screens,
  navigationRules,
}: {
  demo: Demo;
  screens: ScreenWithUrl[];
  navigationRules: NavigationRule[];
}) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(demo.name);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(
    screens.find((s) => s.is_start_screen)?.id ?? screens[0]?.id ?? null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  const previewScreen = screens.find((s) => s.id === previewScreenId) ?? null;

  async function handleRename() {
    setIsRenaming(false);
    if (name.trim() && name !== demo.name) {
      await fetch(`/api/demos/${demo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      router.refresh();
    } else {
      setName(demo.name);
    }
  }

  async function handleToggleActive() {
    await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !demo.is_active }),
    });
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/demos/${demo.id}`, { method: 'DELETE' });
    router.push('/dashboard/demos');
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/embed/${demo.id}`;
    navigator.clipboard.writeText(url);
  }

  const embedCode = `<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://demoframe.io'}/embed/${demo.id}" width="100%" height="600" frameborder="0" allow="clipboard-read; clipboard-write"></iframe>`;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/demos"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; All Demos
          </Link>
          <div className="flex items-center gap-3">
            {isRenaming ? (
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setName(demo.name);
                    setIsRenaming(false);
                  }
                }}
                className="rounded border border-indigo-300 px-2 py-1 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-indigo-600"
                onClick={() => setIsRenaming(true)}
                title="Click to rename"
              >
                {demo.name}
              </h1>
            )}
            <Badge variant={demo.is_active ? 'active' : 'inactive'}>
              {demo.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {demo.app_url && (
            <p className="mt-1 text-sm text-gray-500">{demo.app_url}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Copy Link
          </button>
          <button
            onClick={() => setShowEmbedCode(!showEmbedCode)}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Embed Code
          </button>
          <button
            onClick={handleToggleActive}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {demo.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Embed code dialog */}
      {showEmbedCode && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-indigo-900">Embed Code</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(embedCode);
              }}
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
            >
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-gray-800 border border-indigo-100">
            {embedCode}
          </pre>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm">
          <span className="text-red-700">
            Delete &quot;{demo.name}&quot;? This will remove all screens and
            cannot be undone.
          </span>
          <button
            onClick={handleDelete}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Screens</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{screens.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Nav Rules</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{navigationRules.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Views</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{demo.view_count}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium uppercase text-gray-500">Created</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatDate(demo.created_at)}
          </p>
        </div>
      </div>

      {/* Live Preview */}
      {screens.length > 0 ? (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <Link
              href={`/dashboard/demos/${demo.id}/navigation`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Wire Navigation &rarr;
            </Link>
          </div>
          {previewScreen?.signed_url && (
            <DemoPreview
              signedUrl={previewScreen.signed_url}
              viewportWidth={previewScreen.viewport_width}
              viewportHeight={previewScreen.viewport_height}
            />
          )}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">
            No screens captured yet. Use the Chrome Extension to capture screens.
          </p>
        </div>
      )}

      {/* Screens grid */}
      {screens.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Screens ({screens.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {screens.map((screen) => (
              <button
                key={screen.id}
                onClick={() => setPreviewScreenId(screen.id)}
                className={`group relative rounded-lg border p-2 text-left transition-colors ${
                  previewScreenId === screen.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="aspect-video w-full overflow-hidden rounded bg-gray-100">
                  {screen.signed_url ? (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      {screen.viewport_width} x {screen.viewport_height}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      No preview
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {screen.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(screen.size_bytes)}
                    {screen.is_start_screen && (
                      <span className="ml-2 text-indigo-600">Start screen</span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
