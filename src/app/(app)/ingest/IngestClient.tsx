'use client';

import { useActionState, useMemo, useState, useEffect } from 'react';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };
const init: ActionState = { status: 'idle' };



type ShredResult = {
  extractionMode?: string;
  extractedCount?: number;
  qualityAcceptedCount?: number;
  duplicateSkippedCount?: number;
  insertedCount?: number;
  personalInfoExtracted?: boolean;
  profileAutoUpdated?: boolean;
  entities?: Array<{ id: string; title: string; techStack?: string[]; tags?: string[]; impactScore?: number }>;
};

type AddResult = {
  id?: string;
  title?: string;
  description?: string;
  techStack?: string[];
  tags?: string[];
  impactScore?: number;
  duplicate?: boolean;
};

function ResultContent({ data }: { data: unknown }) {
  const d = data as ShredResult & AddResult;
  if (d.entities && Array.isArray(d.entities)) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {(
            [
              ['Extracted', d.extractedCount],
              ['Accepted', d.qualityAcceptedCount],
              ['Skipped (dup)', d.duplicateSkippedCount],
              ['Inserted', d.insertedCount],
            ] as [string, number | undefined][]
          ).map(([label, val]) => (
            <div key={label}>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{label}</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#15803d', margin: 0 }}>{val ?? 0}</p>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#14532d' }}>
          Header extraction: {d.personalInfoExtracted ? 'detected' : 'not detected'}
          {' · '}
          Profile auto-fill: {d.profileAutoUpdated ? 'updated' : 'no changes'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {d.entities.map((e) => (
            <div key={e.id} style={{ padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #d1fae5', fontSize: '13px' }}>
              <span style={{ fontWeight: 600, color: '#064e3b' }}>{e.title}</span>
              {e.techStack && e.techStack.length > 0 && (
                <span style={{ marginLeft: '8px', color: '#6b7280' }}>{e.techStack.join(', ')}</span>
              )}
              {e.impactScore && (
                <span style={{ marginLeft: '8px', fontWeight: 700, color: '#15803d' }}>⚡{e.impactScore}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (d.id) {
    return (
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#064e3b', margin: '0 0 4px' }}>{d.title}</p>
        {d.description && <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 8px' }}>{d.description}</p>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {d.techStack?.map((t: string) => (
            <span key={t} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#dcfce7', color: '#15803d', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
        {d.duplicate && (
          <p style={{ fontSize: '12px', color: '#b45309', marginTop: '8px' }}>⚠️ This project was already in your vault (duplicate skipped).</p>
        )}
      </div>
    );
  }
  return <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(data, null, 2)}</pre>;
}

function ResultPanel({ state, title }: { state: ActionState; title: string }) {
  if (state.status === 'idle') return null;
  const isError = state.status === 'error';

  return (
    <div
      style={{
        marginTop: '20px',
        borderRadius: '12px',
        border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
        background: isError ? '#fef2f2' : '#f0fdf4',
        padding: '16px',
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isError ? '#b91c1c' : '#15803d', margin: '0 0 8px' }}>
        {isError ? 'Error' : title}
      </p>
      {state.message && <p style={{ fontSize: '13px', color: '#b91c1c', margin: '0 0 8px' }}>{state.message}</p>}
      {!isError && state.data ? <ResultContent data={state.data} /> : null}
    </div>
  );
}

export default function IngestClient({
  shredResumeAction,
  addProjectAction,
}: {
  shredResumeAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  addProjectAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [shredState, shredAction, isShredPending] = useActionState(shredResumeAction, init);
  const [addState, addAction] = useActionState(addProjectAction, init);
  const [shredProgress, setShredProgress] = useState(0);

  useEffect(() => {
    if (!isShredPending) {
      if (shredProgress > 0 && shredProgress < 100) {
        setShredProgress(100);
        const t = window.setTimeout(() => setShredProgress(0), 800);
        return () => window.clearTimeout(t);
      }
      return;
    }
    setShredProgress((c) => (c > 2 ? c : 2));
    const iv = window.setInterval(() => {
      setShredProgress((c) => {
        if (c >= 92) return c;
        if (c < 25) return Math.min(c + 8, 92);
        if (c < 55) return Math.min(c + 5, 92);
        if (c < 80) return Math.min(c + 3, 92);
        return Math.min(c + 1, 92);
      });
    }, 350);
    return () => window.clearInterval(iv);
  }, [isShredPending, shredProgress]);

  const shredPhaseLabel = useMemo(() => {
    if (!isShredPending) return '';
    if (shredProgress < 18) return 'Uploading file';
    if (shredProgress < 45) return 'Parsing resume';
    if (shredProgress < 75) return 'Extracting entities';
    return 'Embedding and saving';
  }, [isShredPending, shredProgress]);

  const inputStyle: React.CSSProperties = {
    borderRadius: '10px',
    border: '1px solid #d6d3d1',
    background: 'white',
    padding: '9px 14px',
    fontSize: '14px',
    color: '#1c1917',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 22px',
    borderRadius: '999px',
    background: '#1c1917',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };

  return (
    <div style={{ padding: '36px 40px', maxWidth: '820px' }}>
      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: '#a8a29e', margin: '0 0 6px' }}>
          Ingest
        </p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1917', margin: 0 }}>
          Add to Your Vault
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#78716c' }}>
          Two ways to grow your vault: shred an entire resume or add individual projects.
        </p>
      </div>

      {/* === Section 1: Resume Upload === */}
      <div
        id="resume"
        style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e7e5e4',
          padding: '28px',
          marginBottom: '20px',
          boxShadow: '0 1px 4px rgba(28,25,23,0.05)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1c1917', margin: '0 0 4px' }}>
            📄 Resume Upload &amp; Shred
          </h2>
          <p style={{ fontSize: '14px', color: '#78716c', margin: 0 }}>
            Upload your master resume and let AI decompose it into multiple atomic vault entities — each separately searchable and embeddable.
          </p>
        </div>

        <form action={shredAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
              Resume file (.pdf, .txt, .md)
              <input
                name="resumeFile"
                type="file"
                required
                accept=".pdf,.txt,.md,.markdown"
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
              Max entities to extract
              <input
                name="maxEntities"
                type="number"
                min={1}
                max={30}
                defaultValue={12}
                style={inputStyle}
              />
            </label>
          </div>

          <div>
            <button
              style={{ ...btnStyle, opacity: isShredPending ? 0.6 : 1, cursor: isShredPending ? 'not-allowed' : 'pointer' }}
              disabled={isShredPending}
            >
              {isShredPending ? 'Processing…' : 'Upload and shred resume'}
            </button>
          </div>
        </form>

        {isShredPending && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#92400e', marginBottom: '8px' }}>
              <span>{shredPhaseLabel}</span>
              <span>{Math.round(shredProgress)}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: '#fde68a', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: '999px',
                  background: '#f59e0b',
                  width: `${Math.max(2, Math.round(shredProgress))}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        <ResultPanel state={shredState} title="Entities extracted and saved" />
      </div>

      {/* === Section 2: Add Project === */}
      <div
        id="project"
        style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e7e5e4',
          padding: '28px',
          boxShadow: '0 1px 4px rgba(28,25,23,0.05)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1c1917', margin: '0 0 4px' }}>
            ✏️ Add Single Project
          </h2>
          <p style={{ fontSize: '14px', color: '#78716c', margin: 0 }}>
            Paste raw project notes — AI will clean, structure, and embed them into your vault automatically.
          </p>
        </div>

        <form action={addAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
            Raw project text
            <textarea
              name="rawInput"
              required
              rows={7}
              placeholder="Built a football scouting app with Next.js and MongoDB that reduced scout reporting time by 40%..."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#44403c' }}>
            Optional tags (comma separated)
            <input
              name="tags"
              placeholder="next.js, mongodb, analytics"
              style={inputStyle}
            />
          </label>
          <div>
            <button style={btnStyle}>
              Ingest project
            </button>
          </div>
        </form>

        <ResultPanel state={addState} title="Project saved to vault" />
      </div>
    </div>
  );
}
