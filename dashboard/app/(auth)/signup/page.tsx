'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setMessage('Check your email for a confirmation link, then sign in.');
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold mb-2">Create your DemoFrame account</h1>
      <p className="text-gray-500 mb-8">Start recording interactive demos in minutes</p>
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
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}
        {message && (
          <p className="text-center text-sm text-green-600">{message}</p>
        )}
      </form>
      <p className="mt-6 text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-black underline hover:no-underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
