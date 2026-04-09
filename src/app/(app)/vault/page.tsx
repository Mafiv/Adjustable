import { listVaultProjects } from '@/app/actions/vault';
import { VaultInlineManager } from '@/app/components/VaultComponents';

export const metadata = {
  title: 'Vault — Adjustable',
  description: 'Browse all your stored project entities and experiences.',
};

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? '1'));

  let data: Awaited<ReturnType<typeof listVaultProjects>> | null = null;
  let error: string | null = null;

  try {
    data = await listVaultProjects({ limit: 18, page });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load vault.';
  }

  const projects = data?.projects ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div style={{ padding: '36px 40px', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#a8a29e', margin: '0 0 6px' }}>
            Vault
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1917', margin: 0 }}>
            Stored Experiences
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#78716c' }}>
            {total} {total === 1 ? 'item' : 'items'} in your vault
          </p>
        </div>
        <a
          href="/ingest"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 18px',
            background: '#1c1917',
            color: 'white',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Resume Ingest
        </a>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '16px 20px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#b91c1c',
            fontSize: '14px',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && projects.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '56px 20px',
            background: 'white',
            borderRadius: '16px',
            border: '1px dashed #d6d3d1',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗄️</div>
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#1c1917', margin: '0 0 8px' }}>
            No vault items yet
          </p>
          <p style={{ fontSize: '14px', color: '#78716c', margin: '0 0 24px' }}>
            Upload your resume or use quick add below to fill your vault.
          </p>
          <a
            href="/ingest"
            style={{
              display: 'inline-block',
              padding: '10px 22px',
              background: '#1c1917',
              color: 'white',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Ingest content →
          </a>
        </div>
      )}

      {/* Vault manager */}
      {!error && (
        <>
          <div style={{ marginBottom: '32px' }}>
            <VaultInlineManager initialProjects={projects} total={total} />
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              {page > 1 && (
                <a
                  href={`/vault?page=${page - 1}`}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '999px',
                    border: '1px solid #e7e5e4',
                    background: 'white',
                    fontSize: '13px',
                    color: '#44403c',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  ← Prev
                </a>
              )}
              <span style={{ fontSize: '13px', color: '#78716c' }}>
                Page {page} of {pages}
              </span>
              {page < pages && (
                <a
                  href={`/vault?page=${page + 1}`}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '999px',
                    border: '1px solid #e7e5e4',
                    background: 'white',
                    fontSize: '13px',
                    color: '#44403c',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
