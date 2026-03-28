import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { createServiceClient } from '@/lib/supabase/service';
import { STORAGE_BUCKET } from '@/lib/constants';

const EmbedPlayer = dynamic(
  () => import('@/components/embed/EmbedPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-500">Loading demo...</p>
        </div>
      </div>
    ),
  }
);

async function getRecording(id: string) {
  const supabase = createServiceClient();

  const { data: recording, error } = await supabase
    .from('recordings')
    .select('id, name, app_url, metadata, is_active, storage_path')
    .eq('id', id)
    .single();

  if (error || !recording || !recording.is_active) {
    return null;
  }

  const { data: signedUrlData } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(recording.storage_path, 300);

  return {
    ...recording,
    signed_url: signedUrlData?.signedUrl ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const recording = await getRecording(params.id);

  if (!recording) {
    return { title: 'Demo not available | DemoFrame' };
  }

  const title = `${recording.name} | DemoFrame Demo`;
  const description = recording.app_url
    ? `Interactive demo of ${recording.app_url} — recorded with DemoFrame`
    : 'Interactive demo — recorded with DemoFrame';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: ['/og-default.svg'],
    },
    robots: { index: true, follow: false },
  };
}

export default async function EmbedPage({
  params,
}: {
  params: { id: string };
}) {
  const recording = await getRecording(params.id);

  if (!recording || !recording.signed_url) {
    notFound();
  }

  return (
    <EmbedPlayer
      signedUrl={recording.signed_url}
      recordingId={recording.id}
      recordingName={recording.name}
    />
  );
}
