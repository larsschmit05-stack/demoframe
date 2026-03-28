'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    // Handle token_hash in URL (direct email template link)
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type) {
      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: type as 'signup' | 'magiclink' | 'email',
        })
        .then(({ error: verifyError }) => {
          if (verifyError) {
            console.error('OTP verify error:', verifyError.message);
            setError(verifyError.message);
            return;
          }
          router.replace('/dashboard');
        });
      return;
    }

    // For PKCE flow: the browser client auto-detects ?code= and exchanges it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/dashboard');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        const timer = setTimeout(() => {
          setError('Unable to verify your authentication. Please try signing in again.');
        }, 5000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p className="text-red-600 mb-4">{error}</p>
        <a href="/login" className="text-black underline">
          Back to sign in
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <p className="text-gray-600">Confirming your authentication...</p>
    </main>
  );
}
