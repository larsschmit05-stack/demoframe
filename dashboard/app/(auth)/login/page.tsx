'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');
  const confirmed = searchParams.get('confirmed');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    confirmed === 'true' ? 'Email confirmed! You can now sign in.' : ''
  );
  const [error, setError] = useState(
    authError === 'auth_failed' ? 'Authentication failed. Please try again.' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      if (signInError.message === 'Email not confirmed') {
        setError('Please confirm your email first. Check your inbox.');
      } else {
        setError(signInError.message);
      }
    } else {
      window.location.href = '/dashboard';
      return;
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold mb-8">Sign in to DemoFrame</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}
        {message && (
          <p className="text-center text-sm text-green-600">{message}</p>
        )}
      </form>
      <p className="mt-6 text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-black underline hover:no-underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
