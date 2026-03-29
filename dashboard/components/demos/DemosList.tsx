'use client';

import DemoRow from './DemoRow';
import DemosEmptyState from './DemosEmptyState';
import type { Demo } from '@/lib/types';

interface DemoWithScreenCount extends Demo {
  screens: [{ count: number }];
}

export default function DemosList({
  demos,
}: {
  demos: DemoWithScreenCount[];
}) {
  if (demos.length === 0) {
    return <DemosEmptyState />;
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
              Screens
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
          {demos.map((demo) => (
            <DemoRow
              key={demo.id}
              demo={demo}
              screenCount={demo.screens?.[0]?.count ?? 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
