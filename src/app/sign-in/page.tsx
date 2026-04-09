'use client';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      router.push('/');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Authentication failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f2ede3,_#e8dfd1_45%,_#d7cdbf)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-neutral-300 bg-white/80 p-8 shadow-[0_22px_60px_rgba(20,14,8,0.2)]">
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">Adjustable Auth</p>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Authenticate to access your personal vault and generation workspace.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {mode === 'sign-up' && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Name
              <input
                name="name"
                required
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            disabled={isSubmitting}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-neutral-700 underline underline-offset-4"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError('');
          }}
        >
          {mode === 'sign-in'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
