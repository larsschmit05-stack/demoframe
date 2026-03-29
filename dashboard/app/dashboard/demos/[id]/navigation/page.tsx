import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { STORAGE_BUCKET } from '@/lib/constants';
import NavigationWiring from '@/components/demos/NavigationWiring';

export default async function NavigationPage({
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
    .select('id, name')
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
    <NavigationWiring
      demo={demo}
      screens={screensWithUrls}
      initialRules={navigationRules || []}
    />
  );
}
