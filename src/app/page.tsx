import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="landing-root">
      {/* ── Navigation ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="landing-logo-mark">A</span>
            <span className="landing-logo-text">Adjustable</span>
          </div>
          <div className="landing-nav-actions">
            <Link href="/sign-in" className="landing-nav-link">Sign in</Link>
            <Link href="/sign-in?mode=sign-up" className="landing-nav-cta">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-1" aria-hidden="true" />
        <div className="landing-hero-glow landing-hero-glow-2" aria-hidden="true" />
        <div className="landing-hero-content">
          <p className="landing-hero-eyebrow">AI-Powered Portfolio Vault</p>
          <h1 className="landing-hero-title">
            Turn experience into <br />
            <span className="landing-hero-gradient">targeted portfolios</span>
          </h1>
          <p className="landing-hero-sub">
            Ingest your master resume, let AI atomise it into searchable vault
            entities, then generate role-specific portfolio drafts in seconds —
            perfectly matched to any job description.
          </p>
          <div className="landing-hero-btns">
            <Link href="/sign-in?mode=sign-up" id="landing-cta-primary" className="landing-btn-primary">
              Start building your vault
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link href="/sign-in" id="landing-cta-secondary" className="landing-btn-ghost">
              Sign in
            </Link>
          </div>
          <p className="landing-hero-note">Free to start · No credit card required</p>
        </div>

        {/* ── Floating mockup card ── */}
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-card landing-card-main">
            <div className="landing-card-header">
              <div className="landing-card-dot" style={{ background: '#f87171' }} />
              <div className="landing-card-dot" style={{ background: '#fbbf24' }} />
              <div className="landing-card-dot" style={{ background: '#4ade80' }} />
              <span className="landing-card-tab">Portfolio Vault</span>
            </div>
            <div className="landing-card-body">
              {[
                { title: 'Led migration to micro-services', score: 9.2, tags: ['Node.js', 'Docker', 'K8s'] },
                { title: 'Built real-time collaboration engine', score: 8.8, tags: ['WebSockets', 'Redis'] },
                { title: 'Designed A/B testing framework', score: 8.1, tags: ['Python', 'Analytics'] },
              ].map((item) => (
                <div key={item.title} className="landing-vault-item">
                  <div className="landing-vault-score">{item.score}</div>
                  <div className="landing-vault-meta">
                    <p className="landing-vault-title">{item.title}</p>
                    <div className="landing-vault-tags">
                      {item.tags.map((t) => (
                        <span key={t} className="landing-vault-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* floating badge */}
          <div className="landing-badge landing-badge-gen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Portfolio generated
          </div>
          <div className="landing-badge landing-badge-match">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            94% match score
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <p className="landing-section-eyebrow">How it works</p>
          <h2 className="landing-section-title">Three steps to your perfect portfolio</h2>
          <div className="landing-steps">
            {[
              {
                step: '01',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                ),
                title: 'Ingest your experience',
                desc: 'Upload your master resume or paste raw project notes. AI shreds them into structured, searchable vault entries.',
              },
              {
                step: '02',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                ),
                title: 'Search & score your vault',
                desc: 'Every project is scored by impact and indexed with vector embeddings so the right experiences surface for any role.',
              },
              {
                step: '03',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                ),
                title: 'Generate & export',
                desc: 'Paste a job description and let GPT-4 assemble the best-matching portfolio draft, then export as a polished PDF.',
              },
            ].map((s) => (
              <div key={s.step} className="landing-step">
                <div className="landing-step-num">{s.step}</div>
                <div className="landing-step-icon">{s.icon}</div>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <p className="landing-section-eyebrow">Features</p>
          <h2 className="landing-section-title">Built for serious job seekers</h2>
          <div className="landing-features">
            {[
              { icon: '🔐', title: 'Private vault', desc: 'Your experience data lives in your personal encrypted vault, never shared.' },
              { icon: '🧠', title: 'Vector search', desc: 'Semantic search finds the most relevant projects for any job posting in milliseconds.' },
              { icon: '📄', title: 'ATS-ready PDFs', desc: 'Export crisp, recruiter-friendly documents that pass automated resume scanners.' },
              { icon: '🎯', title: 'Impact scoring', desc: 'Every vault entry gets an AI-generated impact score so you lead with your best work.' },
              { icon: '⚡', title: 'Instant generation', desc: 'From job description to polished portfolio draft in under 30 seconds.' },
              { icon: '🔄', title: 'Unlimited iterations', desc: 'Tweak the prompt, regenerate, and compare — iterate until it\'s perfect.' },
            ].map((f) => (
              <div key={f.title} className="landing-feature">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="landing-cta-banner">
        <div className="landing-cta-banner-glow" aria-hidden="true" />
        <div className="landing-cta-banner-inner">
          <h2 className="landing-cta-banner-title">Ready to build your vault?</h2>
          <p className="landing-cta-banner-sub">Join professionals who craft role-specific portfolios in minutes, not hours.</p>
          <div className="landing-hero-btns">
            <Link href="/sign-in?mode=sign-up" id="landing-footer-cta" className="landing-btn-primary landing-btn-primary-inv">
              Create your free account
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link href="/sign-in" className="landing-btn-ghost landing-btn-ghost-inv">Already have an account?</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-logo">
            <span className="landing-logo-mark">A</span>
            <span className="landing-logo-text">Adjustable</span>
          </div>
          <p className="landing-footer-copy">© {new Date().getFullYear()} Adjustable. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
