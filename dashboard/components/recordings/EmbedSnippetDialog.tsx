'use client';

import { useState } from 'react';
import CopyButton from '@/components/ui/CopyButton';

export default function EmbedSnippetDialog({
  open,
  onClose,
  recordingId,
}: {
  open: boolean;
  onClose: () => void;
  recordingId: string;
}) {
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('600');

  if (!open) return null;

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `${baseUrl}/embed/${recordingId}`;

  const iframeSnippet = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;

  const responsiveSnippet = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">
  <iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allowfullscreen></iframe>
</div>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Embed Code</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Size controls */}
        <div className="flex gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
            <input
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
            <input
              type="text"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
            />
          </div>
        </div>

        {/* Fixed size iframe */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">iframe</span>
            <CopyButton text={iframeSnippet} label="Copy" />
          </div>
          <pre className="overflow-x-auto rounded bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 whitespace-pre-wrap break-all">
            {iframeSnippet}
          </pre>
        </div>

        {/* Responsive iframe */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Responsive (16:9)</span>
            <CopyButton text={responsiveSnippet} label="Copy" />
          </div>
          <pre className="overflow-x-auto rounded bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 whitespace-pre-wrap break-all">
            {responsiveSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
