'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };
const init: ActionState = { status: 'idle' };

type GenerationContent = {
  summary?: string;
  sections?: Array<{ title?: string; bullets?: string[] }>;
  resumeBullets?: string[];
  markdown?: string;
  keywords?: string[];
  sources?: Array<{ projectId?: string; evidence?: string }>;
  rationale?: string[];
};

type GenResult = {
  generationId?: string;
  format?: string;
  content?: GenerationContent;
};

const inputStyle: React.CSSProperties = {
  borderRadius: '10px',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  padding: '9px 14px',
  fontSize: '14px',
  color: 'var(--input-text)',
  width: '100%',
  outline: 'none',
};

function GenerationResultDisplay({ data }: { data: GenResult }) {
  const { generationId, format, content } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Gen ID banner */}
      {generationId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 16px', background: 'var(--success-bg)',
          border: '1px solid var(--success-border)', borderRadius: '10px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success-text)' }}>Generation saved</span>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--success-text-muted)', background: 'var(--card-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--success-border)' }}>
            {generationId}
          </span>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(generationId)}
            style={{ fontSize: '11px', color: 'var(--success-text)', border: '1px solid var(--success-border)', borderRadius: '999px', padding: '2px 10px', background: 'var(--success-bg)', cursor: 'pointer', fontWeight: 600 }}
          >
            Copy ID
          </button>
          <a
            href={`/exports?id=${generationId}`}
            style={{ fontSize: '11px', color: 'var(--warn-text)', border: '1px solid var(--warn-border)', borderRadius: '999px', padding: '2px 10px', background: 'var(--warn-bg)', textDecoration: 'none', fontWeight: 600, marginLeft: 'auto' }}
          >
            Export PDF →
          </a>
        </div>
      )}

      {/* Summary */}
      {content?.summary && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 8px' }}>Summary</p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, padding: '14px 16px', background: 'var(--summary-bg)', borderRadius: '10px', border: '1px solid var(--summary-border)' }}>
            {content.summary}
          </p>
        </div>
      )}

      {/* Sections */}
      {content?.sections && content.sections.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 10px' }}>Sections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {content.sections.map((section, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>{section.title}</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(section.bullets ?? []).map((b, bi) => (
                    <li key={bi} style={{ fontSize: '13px', color: 'var(--label-color)', lineHeight: 1.5 }}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resume bullets */}
      {content?.resumeBullets && content.resumeBullets.length > 0 && format === 'resume' && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 8px' }}>Resume Bullets</p>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {content.resumeBullets.map((b, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--label-color)', lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords */}
      {content?.keywords && content.keywords.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 8px' }}>Matched Keywords</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {content.keywords.map((k) => (
              <span key={k} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: 'var(--chip-bg)', color: 'var(--chip-text)', border: '1px solid var(--chip-border)', fontWeight: 500 }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {content?.rationale && content.rationale.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 8px' }}>Rationale</p>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {content.rationale.map((r, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function GenerateClient({
  generateAction,
}: {
  generateAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [genState, genAction, isPending] = useActionState(generateAction, init);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isPending) { setDots(''); return; }
    const iv = window.setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    return () => window.clearInterval(iv);
  }, [isPending]);

  const result = genState.status === 'success' && genState.data ? (genState.data as GenResult) : null;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: 'var(--text-subtle)', margin: '0 0 6px' }}>Generate</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: 0 }}>
          Portfolio Generator
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: 1.5 }}>
          Paste a job description and AI will vector-search your vault for the best matching projects, then generate a tailored portfolio draft.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* Form */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
          <form action={genAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
              Job description
              <textarea
                name="jobDescription"
                required
                rows={8}
                placeholder="We need a full-stack engineer with Next.js, MongoDB, and analytics experience..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
              Must-have skills (comma separated)
              <input name="mustHaveSkills" placeholder="mongo, next.js" style={inputStyle} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
                Tone (optional)
                <input name="tone" placeholder="confident, concise" style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
                Audience (optional)
                <input name="audience" placeholder="technical recruiter" style={inputStyle} />
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)', cursor: 'pointer' }}>
              <input name="includeRationale" type="checkbox" style={{ width: '15px', height: '15px' }} />
              Include rationale
            </label>

            <button
              style={{
                padding: '11px 22px', borderRadius: '999px',
                background: 'var(--action-btn-bg)', color: 'var(--action-btn-text)',
                fontSize: '14px', fontWeight: 600, border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
              disabled={isPending}
            >
              {isPending ? `Generating${dots}` : 'Generate portfolio'}
            </button>
          </form>
        </div>

        {/* Result Panel */}
        <div>
          {genState.status === 'idle' && !isPending && (
            <div style={{
              background: 'var(--card-bg)', borderRadius: '16px',
              border: '1px dashed var(--card-border)', padding: '40px 24px',
              textAlign: 'center', color: 'var(--text-subtle)',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>✨</div>
              <p style={{ fontSize: '14px', margin: 0 }}>Generated portfolio will appear here</p>
            </div>
          )}

          {isPending && (
            <div style={{
              background: 'var(--card-bg)', borderRadius: '16px',
              border: '1px solid var(--card-border)', padding: '40px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>⚙️</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 4px' }}>Generating portfolio{dots}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Searching vault and drafting content …</p>
            </div>
          )}

          {genState.status === 'error' && genState.message && (
            <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '12px', color: 'var(--danger-text)', fontSize: '14px' }}>
              <strong>Error:</strong> {genState.message}
            </div>
          )}

          {result && <GenerationResultDisplay data={result} />}
        </div>
      </div>
    </div>
  );
}
