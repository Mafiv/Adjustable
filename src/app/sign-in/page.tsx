'use client';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

/* ── Inner component that reads searchParams ─────────────────────── */

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Honour ?mode=sign-up from the landing page CTA
  useEffect(() => {
    if (searchParams.get('mode') === 'sign-up') setMode('sign-up');
  }, [searchParams]);

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
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'));
    setError('');
  };

  async function signInWithProvider(provider: 'google' | 'github') {
    setError('');
    setSocialLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `${provider} sign-in failed.`);
      setSocialLoading(null);
    }
  }

  return (
    <div className="auth-root">
      {/* ── Left panel ── */}
      <div className="auth-panel-left" aria-hidden="true">
        {/* background glows */}
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />

        {/* Back to home */}
        <Link href="/" className="auth-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
          </svg>
          Back to home
        </Link>

        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-mark">A</div>
          <span className="auth-brand-name">Adjustable</span>
        </div>

        {/* Hero copy */}
        <div className="auth-panel-copy">
          <h2 className="auth-panel-title">
            Your personal<br />
            <span className="auth-panel-title-accent">career vault</span>
          </h2>
          <p className="auth-panel-sub">
            Ingest experience, generate role-specific portfolios, and export ATS-ready PDFs — in minutes.
          </p>
        </div>

        {/* Floating mockup */}
        <div className="auth-mockup">
          <div className="auth-mockup-card">
            <div className="auth-mockup-header">
              <span className="auth-mockup-dot" style={{ background: '#f87171' }} />
              <span className="auth-mockup-dot" style={{ background: '#fbbf24' }} />
              <span className="auth-mockup-dot" style={{ background: '#4ade80' }} />
              <span className="auth-mockup-tab">Portfolio Vault</span>
            </div>
            <div className="auth-mockup-body">
              {[
                { score: 9.2, title: 'Led micro-services migration', tags: ['Node.js', 'K8s'] },
                { score: 8.8, title: 'Built real-time collaboration', tags: ['WebSockets', 'Redis'] },
                { score: 8.1, title: 'Designed A/B test framework', tags: ['Python'] },
              ].map((item) => (
                <div key={item.title} className="auth-mockup-row">
                  <span className="auth-mockup-score">{item.score}</span>
                  <div className="auth-mockup-meta">
                    <p className="auth-mockup-title">{item.title}</p>
                    <div className="auth-mockup-tags">
                      {item.tags.map((t) => (
                        <span key={t} className="auth-mockup-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* stats row */}
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-value">94%</span>
              <span className="auth-stat-label">Match score</span>
            </div>
            <div className="auth-stat-divider" />
            <div className="auth-stat">
              <span className="auth-stat-value">&lt;30s</span>
              <span className="auth-stat-label">Generation time</span>
            </div>
            <div className="auth-stat-divider" />
            <div className="auth-stat">
              <span className="auth-stat-value">ATS</span>
              <span className="auth-stat-label">Ready PDFs</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="auth-panel-right">
        {/* Mobile back link */}
        <Link href="/" className="auth-back-link auth-back-link-mobile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
          </svg>
          Back
        </Link>

        <div className="auth-form-wrap">
          {/* Mode tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              id="auth-tab-signin"
              className={`auth-tab ${mode === 'sign-in' ? 'active' : ''}`}
              onClick={() => { setMode('sign-in'); setError(''); }}
            >
              Sign in
            </button>
            <button
              type="button"
              id="auth-tab-signup"
              className={`auth-tab ${mode === 'sign-up' ? 'active' : ''}`}
              onClick={() => { setMode('sign-up'); setError(''); }}
            >
              Create account
            </button>
          </div>

          {/* Heading */}
          <div className="auth-heading">
            <h1 className="auth-title">
              {mode === 'sign-in' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="auth-subtitle">
              {mode === 'sign-in'
                ? 'Sign in to access your vault and workspace.'
                : 'Create your account and start building your vault today.'}
            </p>
          </div>

          {/* ── Social OAuth buttons ── */}
          <div className="auth-social-btns">
            <button
              id="auth-google-btn"
              type="button"
              className="auth-social-btn"
              onClick={() => signInWithProvider('google')}
              disabled={!!socialLoading || isSubmitting}
            >
              {socialLoading === 'google' ? (
                <span className="auth-spinner auth-spinner-dark" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>
            <button
              id="auth-github-btn"
              type="button"
              className="auth-social-btn"
              onClick={() => signInWithProvider('github')}
              disabled={!!socialLoading || isSubmitting}
            >
              {socialLoading === 'github' ? (
                <span className="auth-spinner auth-spinner-dark" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              )}
              Continue with GitHub
            </button>
          </div>

          {/* ── Divider ── */}
          <div className="auth-divider">
            <span className="auth-divider-line" />
            <span className="auth-divider-text">or continue with email</span>
            <span className="auth-divider-line" />
          </div>

          {/* Form */}
          <form id="auth-form" onSubmit={onSubmit} className="auth-form" noValidate>
            {mode === 'sign-up' && (
              <div className="auth-field" id="auth-field-name">
                <label htmlFor="auth-name" className="auth-label">Full name</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Alex Johnson"
                    autoComplete="name"
                    className="auth-input"
                  />
                </div>
              </div>
            )}

            <div className="auth-field" id="auth-field-email">
              <label htmlFor="auth-email" className="auth-label">Email address</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field" id="auth-field-password">
              <div className="auth-label-row">
                <label htmlFor="auth-password" className="auth-label">Password</label>
                {mode === 'sign-in' && (
                  <span className="auth-forgot">Forgot password?</span>
                )}
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder={mode === 'sign-up' ? 'Min. 8 characters' : '••••••••'}
                  autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                  className="auth-input auth-input-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="auth-error" role="alert" id="auth-error-msg">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="auth-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="auth-spinner" />
                  Please wait…
                </>
              ) : mode === 'sign-in' ? (
                <>
                  Sign in
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Create account
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="auth-switch">
            {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button type="button" id="auth-switch-btn" className="auth-switch-link" onClick={switchMode}>
              {mode === 'sign-in' ? 'Create one' : 'Sign in'}
            </button>
          </p>

          {/* Terms */}
          {mode === 'sign-up' && (
            <p className="auth-terms">
              By creating an account you agree to our{' '}
              <span className="auth-terms-link">Terms of Service</span> and{' '}
              <span className="auth-terms-link">Privacy Policy</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page wrapper with Suspense for useSearchParams ─────────────── */

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
