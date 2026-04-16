import Link from 'next/link';
import { listVaultProjects, listPortfolioGenerations } from '@/app/actions/vault';
import { StatCard, QuickAction } from '@/app/components/DashboardComponents';

export default async function DashboardPage() {
  const [vaultData, genData] = await Promise.allSettled([
    listVaultProjects({ limit: 5, page: 1 }),
    listPortfolioGenerations({ limit: 3, page: 1 }),
  ]);

  const vault = vaultData.status === 'fulfilled' ? vaultData.value : null;
  const generations = genData.status === 'fulfilled' ? genData.value : null;

  const recentProjects = vault?.projects ?? [];
  const recentGenerations = generations?.generations ?? [];
  const vaultTotal = vault?.total ?? 0;
  const genTotal = generations?.total ?? 0;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '8px' }}>
        <p
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.35em',
            color: '#a8a29e',
            margin: '0 0 6px',
          }}
        >
          Welcome back
        </p>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#1c1917',
            margin: 0,
          }}
        >
          Your Portfolio Vault
        </h1>
        {/* <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#78716c', maxWidth: '680px', lineHeight: 1.5 }}>
          Ingest your experience, then generate tailored portfolio drafts for any job description using AI and vector search.
        </p> */}
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <StatCard label="Vault Items" value={vaultTotal} sub="projects stored" accent="#b87a38" />
        <StatCard label="Generations" value={genTotal} sub="portfolios created" />
        <StatCard
          label="Avg Impact Score"
          value={
            recentProjects.length > 0
              ? (recentProjects.reduce((s, p) => s + (p.impactScore ?? 0), 0) / recentProjects.length).toFixed(1)
              : '—'
          }
          sub="out of 10"
        />
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 12px' }}>
        Quick Actions
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          rowGap: '16px',
          columnGap: '20px',
          marginBottom: '40px',
        }}
      >
        <QuickAction
          href="/ingest"
          label="Upload Resume"
          description="Shred your master resume into atomic vault entities."
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
          }
        />
        <QuickAction
          href="/ingest#project"
          label="Add Project"
          description="Paste raw project notes and let AI structure them."
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
            </svg>
          }
        />
        <QuickAction
          href="/generate"
          label="Generate Portfolio"
          description="Match a job description to your best projects with AI."
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          }
        />
        <QuickAction
          href="/vault"
          label="Browse Vault"
          description="View, search, and review all your stored experiences."
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          }
        />
      </div>

      {/* Recent Vault Items */}
      {recentProjects.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: 0 }}>
              Recent Vault Items
            </h2>
            <Link href="/vault" style={{ fontSize: '13px', color: '#b87a38', textDecoration: 'none', fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {recentProjects.map((project) => (
              <div
                key={project.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 20px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e7e5e4',
                  margin: '0 0 12px 0',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#faf6f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#b87a38',
                    flexShrink: 0,
                  }}
                >
                  {project.impactScore}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.title}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.3px' }}>
                    {project.description}
                  </p>
                  {project.techStack.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {project.techStack.slice(0, 4).map((t: string) => (
                        <span
                          key={t}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            background: '#f2ebe0',
                            color: '#7a4f1e',
                            fontWeight: 500,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#a8a29e', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {project.createdAt ? new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Generations */}
      {recentGenerations.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: 0 }}>
              Recent Generations
            </h2>
            <Link href="/exports" style={{ fontSize: '13px', color: '#b87a38', textDecoration: 'none', fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {recentGenerations.map((gen) => (
              <div
                key={gen.id}
                style={{
                  padding: '14px 20px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e7e5e4',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  margin: '0 0 12px 0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gen.summary || gen.jobDescription}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#78716c' }}>Format: <strong>{gen.outputFormat}</strong></span>
                    <span style={{ fontSize: '12px', color: '#78716c' }}>{gen.sectionsCount} sections</span>
                    <span style={{ fontSize: '12px', color: '#78716c' }}>{gen.keywordsCount} keywords</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: '#a8a29e' }}>
                    {gen.createdAt ? new Date(gen.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <Link
                    href={`/exports?id=${gen.id}`}
                    style={{ fontSize: '12px', color: '#b87a38', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Export PDF →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {vaultTotal === 0 && genTotal === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '16px',
            border: '1px dashed #d6d3d1',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1c1917', margin: '0 0 6px' }}>Your vault is empty</p>
          <p style={{ fontSize: '14px', color: '#78716c', margin: '0 0 20px' }}>
            Start by uploading a resume or adding a project to get going.
          </p>
          <Link
            href="/ingest"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: '#1c1917',
              color: 'white',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Get started →
          </Link>
        </div>
      )}
    </div>
  );
}
