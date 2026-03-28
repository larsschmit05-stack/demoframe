import { createClient } from '@/lib/supabase/server';
import AccountSignOut from '@/components/AccountSignOut';

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Account</h1>

      <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {profile?.email ?? user?.email ?? '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {profile?.full_name || 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Member since</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '-'}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <AccountSignOut />
        </div>
      </div>
    </div>
  );
}
