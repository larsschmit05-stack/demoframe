import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/constants';
import RecordingMetadata from '@/components/recordings/RecordingMetadata';
import RecordingActions from '@/components/recordings/RecordingActions';

const RecordingPlayer = dynamic(
  () => import('@/components/recordings/RecordingPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading player...</p>
        </div>
      </div>
    ),
  }
);

export default async function RecordingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: recording, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !recording) {
    notFound();
  }

  const { data: signedUrlData } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(recording.storage_path, 300);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/recordings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to recordings
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-4">{recording.name}</h1>

      <div className="mb-6">
        <RecordingActions recording={recording} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {signedUrlData?.signedUrl ? (
            <RecordingPlayer signedUrl={signedUrlData.signedUrl} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8">
              <p className="text-sm text-red-600">
                Failed to load recording file.
              </p>
            </div>
          )}
        </div>
        <div>
          <RecordingMetadata recording={recording} />
        </div>
      </div>
    </div>
  );
}
