'use client';

import RecordingRow from './RecordingRow';
import EmptyState from './EmptyState';
import type { Recording } from '@/lib/types';

export default function RecordingsList({
  recordings,
}: {
  recordings: Recording[];
}) {
  if (recordings.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Name
            </th>
            <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              URL
            </th>
            <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Views
            </th>
            <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Date
            </th>
            <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Status
            </th>
            <th className="pb-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {recordings.map((recording) => (
            <RecordingRow key={recording.id} recording={recording} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
