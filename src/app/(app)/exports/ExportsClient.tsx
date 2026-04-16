'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };
const init: ActionState = { status: 'idle' };

type Generation = {
  id: string;
  jobDescription: string;
  outputFormat: string;
  topK: number;
  mustHaveSkills: string[];
  model: string;
  createdAt: string | null;
  summary: string;
  keywordsCount: number;
  sectionsCount: number;
};

type AnalyticsData = {
  windowDays?: number;
  generationCount?: number;
  events?: Record<string, number>;
  rates?: { positiveRate?: number; exportToApplyRate?: number };
};

function downloadBase64Pdf(fileName: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

const inputStyle: React.CSSProperties = {
  borderRadius: '10px',
  border: '1px solid #d6d3d1',
  background: 'white',
  padding: '9px 14px',
  fontSize: '14px',
  color: '#1c1917',
  outline: 'none',
};

export default function ExportsClient({
  generations,
  total,
  pages,
  page,
  exportPdfAction,
  feedbackAction,
  analyticsAction,
  initialId,
}: {
  generations: Generation[];
  total: number;
  pages: number;
  page: number;
  exportPdfAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  feedbackAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  analyticsAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initialId: string;
}) {
  const [pdfState, pdfAction] = useActionState(exportPdfAction, init);
  const [feedbackState, feedbackFormAction] = useActionState(feedbackAction, init);
  const [analyticsState, analyticsFormAction] = useActionState(analyticsAction, init);
  const [activeId, setActiveId] = useState(initialId);

  const pdfData =
    pdfState.status === 'success' &&
    pdfState.data &&
    typeof pdfState.data === 'object' &&
    'base64' in pdfState.data &&
    'fileName' in pdfState.data
      ? (pdfState.data as { base64: string; fileName: string })
      : null;

  useEffect(() => {
    if (pdfData) downloadBase64Pdf(pdfData.fileName, pdfData.base64);
  }, [pdfData]);

  const analyticsData = analyticsState.status === 'success' ? (analyticsState.data as AnalyticsData) : null;

  return (
    <div className="exports-page" style={{ padding: '24px 32px', maxWidth: '1120px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#a8a29e', margin: '0 0 6px' }}>Exports</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1917', margin: 0 }}>
          Portfolio Generations
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#78716c' }}>
          {total} {total === 1 ? 'generation' : 'generations'} saved — export to PDF, record feedback, or review analytics.
        </p>
      </div>

      <div className="exports-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left: generations list */}
        <div className="exports-list-column">
          {generations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '16px', border: '1px dashed #d6d3d1' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#1c1917', margin: '0 0 6px' }}>No generations yet</p>
              <p style={{ fontSize: '14px', color: '#78716c', margin: '0 0 20px' }}>Generate your first portfolio from the Generate page.</p>
              <a href="/generate" style={{ display: 'inline-block', padding: '10px 20px', background: '#1c1917', color: 'white', borderRadius: '999px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
                Go to Generate →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  onClick={() => setActiveId(gen.id)}
                  style={{
                    padding: '16px 20px',
                    background: 'white',
                    borderRadius: '14px',
                    border: `2px solid ${activeId === gen.id ? '#b87a38' : '#e7e5e4'}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: activeId === gen.id ? '0 0 0 3px rgba(184,122,56,0.12)' : '0 1px 4px rgba(28,25,23,0.04)',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {gen.summary || gen.jobDescription}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {gen.jobDescription}
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', color: '#a8a29e', flexShrink: 0 }}>
                      {gen.createdAt ? new Date(gen.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#f2ebe0', color: '#7a4f1e', fontWeight: 500 }}>{gen.outputFormat}</span>
                    <span style={{ fontSize: '11px', color: '#78716c' }}>{gen.sectionsCount} sections</span>
                    <span style={{ fontSize: '11px', color: '#78716c' }}>{gen.keywordsCount} keywords</span>
                    {gen.mustHaveSkills.length > 0 && (
                      <span style={{ fontSize: '11px', color: '#78716c' }}>Skills: {gen.mustHaveSkills.join(', ')}</span>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', fontFamily: 'monospace', color: '#a8a29e' }}>{gen.id}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              {page > 1 && (
                <a href={`/exports?page=${page - 1}`} style={{ padding: '7px 14px', borderRadius: '999px', border: '1px solid #e7e5e4', background: 'white', fontSize: '13px', color: '#44403c', textDecoration: 'none' }}>
                  ← Prev
                </a>
              )}
              <span style={{ fontSize: '13px', color: '#78716c' }}>Page {page} of {pages}</span>
              {page < pages && (
                <a href={`/exports?page=${page + 1}`} style={{ padding: '7px 14px', borderRadius: '999px', border: '1px solid #e7e5e4', background: 'white', fontSize: '13px', color: '#44403c', textDecoration: 'none' }}>
                  Next →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right: actions sidebar */}
        <div className="exports-actions-column" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* PDF Export */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e7e5e4', padding: '20px', boxShadow: '0 1px 4px rgba(28,25,23,0.05)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1c1917', margin: '0 0 12px' }}>📥 Export PDF</h2>
            <form action={pdfAction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#44403c' }}>
                Generation ID
                <input
                  name="generationId"
                  required
                  value={activeId}
                  onChange={(e) => setActiveId(e.target.value)}
                  placeholder="Select a generation or paste ID"
                  style={{ ...inputStyle, fontSize: '12px', fontFamily: 'monospace' }}
                />
              </label>
              <button
                style={{ padding: '9px 18px', borderRadius: '999px', background: '#1c1917', color: 'white', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Build PDF
              </button>
            </form>
            {pdfState.status === 'error' && (
              <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{pdfState.message}</p>
            )}
            {pdfData && (
              <p style={{ fontSize: '12px', color: '#15803d', marginTop: '8px' }}>✓ PDF downloading: {pdfData.fileName}</p>
            )}
          </div>

          {/* Feedback */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e7e5e4', padding: '20px', boxShadow: '0 1px 4px rgba(28,25,23,0.05)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1c1917', margin: '0 0 12px' }}>💬 Record Feedback</h2>
            <form action={feedbackFormAction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="hidden" name="generationId" value={activeId} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#44403c' }}>
                Event type
                <select name="eventType" defaultValue="view" style={{ ...inputStyle, fontSize: '12px' }}>
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                  <option value="export_pdf">Export PDF</option>
                  <option value="apply">Apply</option>
                  <option value="positive">👍 Positive</option>
                  <option value="negative">👎 Negative</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#44403c' }}>
                Note (optional)
                <input name="note" style={{ ...inputStyle, fontSize: '12px' }} />
              </label>
              <button style={{ padding: '8px 16px', borderRadius: '999px', background: '#44403c', color: 'white', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                Record
              </button>
            </form>
            {feedbackState.status === 'success' && (
              <p style={{ fontSize: '12px', color: '#15803d', marginTop: '8px' }}>✓ Feedback recorded</p>
            )}
            {feedbackState.status === 'error' && (
              <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{feedbackState.message}</p>
            )}
          </div>

          {/* Analytics */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e7e5e4', padding: '20px', boxShadow: '0 1px 4px rgba(28,25,23,0.05)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1c1917', margin: '0 0 12px' }}>📊 Analytics</h2>
            <form action={analyticsFormAction} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#44403c', flex: 1 }}>
                Window (days)
                <input name="windowDays" type="number" min={1} max={365} defaultValue={30} style={{ ...inputStyle, fontSize: '12px' }} />
              </label>
              <button style={{ padding: '9px 14px', borderRadius: '999px', background: '#44403c', color: 'white', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                Fetch
              </button>
            </form>
            {analyticsData && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="exports-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    ['Generations', analyticsData.generationCount],
                    ['Views', analyticsData.events?.view],
                    ['Exports', analyticsData.events?.export_pdf],
                    ['Applied', analyticsData.events?.apply],
                    ['👍 Positive', analyticsData.events?.positive],
                    ['👎 Negative', analyticsData.events?.negative],
                  ].map(([label, val]) => (
                    <div key={String(label)} style={{ padding: '8px', background: '#faf6f0', borderRadius: '8px' }}>
                      <p style={{ fontSize: '10px', color: '#78716c', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: '#1c1917', margin: 0 }}>{val ?? 0}</p>
                    </div>
                  ))}
                </div>
                {analyticsData.rates && (
                  <div style={{ fontSize: '12px', color: '#78716c', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span>Positive rate: <strong>{((analyticsData.rates.positiveRate ?? 0) * 100).toFixed(0)}%</strong></span>
                    <span>Export→Apply rate: <strong>{((analyticsData.rates.exportToApplyRate ?? 0) * 100).toFixed(0)}%</strong></span>
                  </div>
                )}
              </div>
            )}
            {analyticsState.status === 'error' && (
              <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{analyticsState.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
