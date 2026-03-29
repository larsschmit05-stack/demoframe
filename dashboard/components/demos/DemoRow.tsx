'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import type { Demo } from '@/lib/types';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function extractDomain(url: string | null) {
  if (!url) return '-';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function DemoRow({
  demo,
  screenCount,
}: {
  demo: Demo;
  screenCount: number;
}) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(demo.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
    setMenuOpen(false);
    await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !demo.is_active }),
    });
    router.refresh();
  }

  function handleCopyLink() {
    setMenuOpen(false);
    const url = `${window.location.origin}/embed/${demo.id}`;
    navigator.clipboard.writeText(url);
  }

  async function handleDelete() {
    await fetch(`/api/demos/${demo.id}`, { method: 'DELETE' });
    setDeleteConfirm(false);
    router.refresh();
  }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="py-3 pr-4">
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
              className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <Link
              href={`/dashboard/demos/${demo.id}`}
              className="text-sm font-medium text-gray-900 hover:text-indigo-600"
            >
              {demo.name}
            </Link>
          )}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-500">
          {extractDomain(demo.app_url)}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-500">
          {screenCount}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-500">
          {demo.view_count}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-500">
          {formatDate(demo.created_at)}
        </td>
        <td className="py-3 pr-4">
          <Badge variant={demo.is_active ? 'active' : 'inactive'}>
            {demo.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </td>
        <td className="py-3 text-right relative">
          <div ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setIsRenaming(true); }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Copy share link
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(); }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {demo.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setDeleteConfirm(true); }}
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {deleteConfirm && (
        <tr>
          <td colSpan={7}>
            <div className="flex items-center gap-3 bg-red-50 px-4 py-3 text-sm">
              <span className="text-red-700">Delete &quot;{demo.name}&quot;? This cannot be undone.</span>
              <button onClick={handleDelete} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Delete</button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs text-gray-600 hover:text-gray-800">Cancel</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
