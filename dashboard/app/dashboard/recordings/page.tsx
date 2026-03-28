import { createClient } from '@/lib/supabase/server';
import RecordingsList from '@/components/recordings/RecordingsList';

export default async function RecordingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recordings } = await supabase
    .from('recordings')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Recordings</h1>
      <RecordingsList recordings={recordings ?? []} />
    </div>
  );
}
