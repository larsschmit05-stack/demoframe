import { createClient } from '@/lib/supabase/server';
import SidebarNav from '@/components/SidebarNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-6 flex flex-col">
        <h2 className="text-lg font-bold mb-6">DemoFrame</h2>
        <SidebarNav userEmail={user?.email ?? ''} />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
