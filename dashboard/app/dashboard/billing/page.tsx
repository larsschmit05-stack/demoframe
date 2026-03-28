import { createClient } from '@/lib/supabase/server';
import Badge from '@/components/ui/Badge';
import { FREE_RECORDING_LIMIT } from '@/lib/constants';

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single();

  const tier = profile?.subscription_tier ?? 'free';
  const isPro = tier === 'pro';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Current Plan
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isPro
                  ? 'Unlimited recordings and premium features.'
                  : `Free plan \u2014 ${FREE_RECORDING_LIMIT} active recordings.`}
              </p>
            </div>
            <Badge variant={isPro ? 'pro' : 'free'}>
              {isPro ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </div>

        {!isPro && (
          <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6">
            <h2 className="text-lg font-semibold text-purple-900">
              Upgrade to Pro
            </h2>
            <p className="mt-1 text-sm text-purple-700">
              Get unlimited recordings, custom branding, and advanced analytics.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-purple-800">
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Unlimited active recordings
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Remove DemoFrame branding
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Detailed analytics and insights
              </li>
            </ul>
            <button
              disabled
              className="mt-6 rounded-md bg-purple-600 px-6 py-2 text-sm font-medium text-white opacity-75 cursor-not-allowed"
            >
              Coming soon
            </button>
            <p className="mt-2 text-xs text-purple-600">
              Stripe integration will be available in a future update.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
