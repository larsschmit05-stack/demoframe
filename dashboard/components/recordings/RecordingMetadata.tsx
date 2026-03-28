import Badge from '@/components/ui/Badge';
import type { Recording } from '@/lib/types';
import type { RecordingMetadataFields } from '@/lib/types';

function formatDuration(ms: number | undefined) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number | undefined) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordingMetadata({
  recording,
}: {
  recording: Recording;
}) {
  const meta = recording.metadata as RecordingMetadataFields;

  const fields = [
    { label: 'App URL', value: recording.app_url || '-' },
    { label: 'Created', value: formatDate(recording.created_at) },
    { label: 'Updated', value: formatDate(recording.updated_at) },
    { label: 'Views', value: recording.view_count.toString() },
    { label: 'Duration', value: formatDuration(meta.duration) },
    { label: 'Events', value: meta.eventCount?.toString() ?? '-' },
    { label: 'Elements', value: meta.elementCount?.toString() ?? '-' },
    { label: 'File size', value: formatBytes(meta.sizeBytes) },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Details</h3>
        <Badge variant={recording.is_active ? 'active' : 'inactive'}>
          {recording.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <dl className="space-y-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between">
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
