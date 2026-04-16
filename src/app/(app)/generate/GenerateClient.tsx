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
  border: '1px solid #d6d3d1',
  background: 'white',
  padding: '9px 14px',
  fontSize: '14px',
  color: '#1c1917',
  width: '100%',
  outline: 'none',
};

function GenerationResultDisplay({ data }: { data: GenResult }) {
  const { generationId, format, content } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Gen ID banner */}
      {generationId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>Generation saved</span>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#374151', background: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
            {generationId}
          </span>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(generationId)}
            style={{ fontSize: '11px', color: '#15803d', border: '1px solid #86efac', borderRadius: '999px', padding: '2px 10px', background: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            Copy ID
          </button>
          <a
            href={`/exports?id=${generationId}`}
            style={{ fontSize: '11px', color: '#b87a38', border: '1px solid #fcd34d', borderRadius: '999px', padding: '2px 10px', background: '#fffbeb', textDecoration: 'none', fontWeight: 600, marginLeft: 'auto' }}
          >
            Export PDF →
          </a>
        </div>
      )}

      {/* Summary */}
      {content?.summary && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 8px' }}>Summary</p>
          <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0, padding: '14px 16px', background: '#faf6f0', borderRadius: '10px', border: '1px solid #e5d8c4' }}>
            {content.summary}
          </p>
        </div>
      )}

      {/* Sections */}
      {content?.sections && content.sections.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 10px' }}>Sections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {content.sections.map((section, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1c1917', margin: '0 0 8px' }}>{section.title}</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(section.bullets ?? []).map((b, bi) => (
                    <li key={bi} style={{ fontSize: '13px', color: '#44403c', lineHeight: 1.5 }}>{b}</li>
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
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 8px' }}>Resume Bullets</p>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {content.resumeBullets.map((b, i) => (
              <li key={i} style={{ fontSize: '13px', color: '#44403c', lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords */}
      {content?.keywords && content.keywords.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 8px' }}>Matched Keywords</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {content.keywords.map((k) => (
              <span key={k} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: '#f2ebe0', color: '#7a4f1e', fontWeight: 500 }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {content?.rationale && content.rationale.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', margin: '0 0 8px' }}>Rationale</p>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {content.rationale.map((r, i) => (
              <li key={i} style={{ fontSize: '13px', color: '#78716c', lineHeight: 1.5, fontStyle: 'italic' }}>{r}</li>
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
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#a8a29e', margin: '0 0 6px' }}>Generate</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1917', margin: 0 }}>
          Portfolio Generator
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#78716c', maxWidth: '480px', lineHeight: 1.5 }}>
          Paste a job description and AI will vector-search your vault for the best matching projects, then generate a tailored portfolio draft.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* Form */}
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e7e5e4',
            padding: '24px',
            boxShadow: '0 1px 4px rgba(28,25,23,0.05)',
          }}
        >
          <form action={genAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
              Job description
              <textarea
                name="jobDescription"
                required
                rows={8}
                placeholder="We need a full-stack engineer with Next.js, MongoDB, and analytics experience..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </label>


            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
              Must-have skills (comma separated)
              <input name="mustHaveSkills" placeholder="mongo, next.js" style={inputStyle} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
                Tone (optional)
                <input name="tone" placeholder="confident, concise" style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
                Audience (optional)
                <input name="audience" placeholder="technical recruiter" style={inputStyle} />
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#44403c', cursor: 'pointer' }}>
              <input name="includeRationale" type="checkbox" style={{ width: '15px', height: '15px' }} />
              Include rationale
            </label>

            <button
              style={{
                padding: '11px 22px',
                borderRadius: '999px',
                background: '#1c1917',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
                transition: 'opacity 0.15s',
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
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px dashed #d6d3d1',
                padding: '40px 24px',
                textAlign: 'center',
                color: '#a8a29e',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>✨</div>
              <p style={{ fontSize: '14px', margin: 0 }}>Generated portfolio will appear here</p>
            </div>
          )}

          {isPending && (
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e7e5e4',
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>⚙️</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#1c1917', margin: '0 0 4px' }}>Generating portfolio{dots}</p>
              <p style={{ fontSize: '13px', color: '#78716c', margin: 0 }}>Searching vault and drafting content …</p>
            </div>
          )}

          {genState.status === 'error' && genState.message && (
            <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c', fontSize: '14px' }}>
              <strong>Error:</strong> {genState.message}
            </div>
          )}

          {result && <GenerationResultDisplay data={result} />}
        </div>
      </div>
    </div>
  );
}
