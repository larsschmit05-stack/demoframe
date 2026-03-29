import { createClient } from '@/lib/supabase/server';
import DemosList from '@/components/demos/DemosList';

export default async function DemosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: demos } = await supabase
    .from('demos')
    .select(`
      *,
      screens(count)
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Demos</h1>
      <DemosList demos={demos ?? []} />
    </div>
  );
}
