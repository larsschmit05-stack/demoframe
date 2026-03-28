'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    const code = params.get('code');

    // Handle token_hash verification (email confirmation link)
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
          // Email confirmed — redirect to login so user can sign in with password
          router.replace('/login?confirmed=true');
        });
      return;
    }

    // Handle PKCE code exchange
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error('Code exchange error:', exchangeError.message);
          // Even if exchange fails, email may be confirmed — send to login
          router.replace('/login?confirmed=true');
          return;
        }
        router.replace('/dashboard');
      });
      return;
    }

    // Check for session from auto-detected auth (hash fragments, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/dashboard');
      }
    });

    // Fallback: if nothing to process, redirect to login
    const timer = setTimeout(() => {
      router.replace('/login?confirmed=true');
    }, 3000);

    return () => {
      clearTimeout(timer);
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
      <p className="text-gray-600">Confirming your email...</p>
    </main>
  );
}
