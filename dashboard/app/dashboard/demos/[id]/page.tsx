import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { STORAGE_BUCKET } from '@/lib/constants';
import DemoDetail from '@/components/demos/DemoDetail';

export default async function DemoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: demo } = await supabase
    .from('demos')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!demo) notFound();

  const { data: screens } = await supabase
    .from('screens')
    .select('*')
    .eq('demo_id', params.id)
    .order('sort_order', { ascending: true });

  const { data: navigationRules } = await supabase
    .from('navigation_rules')
    .select('*')
    .eq('demo_id', params.id);

  // Generate signed URLs for screen thumbnails/previews
  const screensWithUrls = await Promise.all(
    (screens || []).map(async (screen) => {
      const { data: signedUrlData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(screen.storage_path, 3600);

      return {
        ...screen,
        signed_url: signedUrlData?.signedUrl || null,
      };
    })
  );

  return (
    <DemoDetail
      demo={demo}
      screens={screensWithUrls}
      navigationRules={navigationRules || []}
    />
  );
}
