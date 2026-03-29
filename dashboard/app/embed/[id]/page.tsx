import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { createServiceClient } from '@/lib/supabase/service';

const DemoPlayer = dynamic(
  () => import('@/components/embed/DemoPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          <p className="mt-3 text-sm text-gray-500">Loading demo...</p>
        </div>
      </div>
    ),
  }
);

async function getDemo(id: string) {
  const supabase = createServiceClient();

  const { data: demo, error } = await supabase
    .from('demos')
    .select('id, name, app_url, is_active')
    .eq('id', id)
    .single();

  if (error || !demo || !demo.is_active) {
    return null;
  }

  return demo;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const demo = await getDemo(params.id);

  if (!demo) {
    return { title: 'Demo not available | DemoFrame' };
  }

  const title = `${demo.name} | DemoFrame Demo`;
  const description = demo.app_url
    ? `Interactive demo of ${demo.app_url} — powered by DemoFrame`
    : 'Interactive demo — powered by DemoFrame';

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
  const demo = await getDemo(params.id);

  if (!demo) {
    notFound();
  }

  return (
    <DemoPlayer
      demoId={demo.id}
      demoName={demo.name}
    />
  );
}
