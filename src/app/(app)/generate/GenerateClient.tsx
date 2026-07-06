'use client';

import Link from 'next/link';
import { base64ToPdfBlobUrl, downloadBase64Pdf } from '@/lib/pdf-client';
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

type PdfPayload = {
  fileName: string;
  base64: string;
};

type GenResult = {
  generationId?: string;
  format?: string;
  content?: GenerationContent & {
    workExperience?: Array<{ company: string; role: string; bullets: string[] }>;
    projects?: Array<{ title: string; description?: string }>;
  };
  pdf?: PdfPayload;
  pdfError?: string;
  pdfBlocked?: boolean;
  blockedExport?: boolean;
  retrieval?: {
    candidateCount: number;
    selectedCount: number;
    candidateTitles: string[];
    retrievalMode?: 'vector' | 'vault_fallback';
    vaultProjectCount?: number;
    projectsWithEmbeddings?: number;
    mustHaveSkillsFilterReduced?: boolean;
  };
  jdGaps?: {
    missingInVault: string[];
    missingMustHave: string[];
    hasGaps: boolean;
  };
  profileCompleteness?: {
    missingCore: string[];
    isCoreComplete: boolean;
  };
  completeness?: {
    ok: boolean;
    warnings: string[];
  };
};

type Preflight = {
  vaultProjectCount: number;
  profileCompleteness: {
    missingCore: string[];
    missingOptional: string[];
    isCoreComplete: boolean;
  };
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

function PdfPreviewPanel({ pdf }: { pdf: PdfPayload }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = base64ToPdfBlobUrl(pdf.base64);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf.base64]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: 0 }}>
          PDF Preview
        </p>
        <button
          type="button"
          onClick={() => downloadBase64Pdf(pdf.fileName, pdf.base64)}
          style={{
            fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px',
            border: 'none', background: 'var(--action-btn-bg)', color: 'var(--action-btn-text)', cursor: 'pointer',
          }}
        >
          Download PDF
        </button>
      </div>
      {previewUrl && (
        <iframe
          title="Portfolio PDF preview"
          src={previewUrl}
          style={{
            width: '100%',
            minHeight: '560px',
            height: '70vh',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            background: '#fff',
          }}
        />
      )}
    </div>
  );
}

function GenerationResultDisplay({
  data,
  exportPdfAction,
}: {
  data: GenResult;
  exportPdfAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const { generationId, format, content, pdf, pdfError } = data;
  const [retryState, retryPdfAction, isPdfRetrying] = useActionState(exportPdfAction, init);
  const [retriedPdf, setRetriedPdf] = useState<PdfPayload | null>(null);

  useEffect(() => {
    if (
      retryState.status === 'success' &&
      retryState.data &&
      typeof retryState.data === 'object' &&
      'pdf' in retryState.data
    ) {
      setRetriedPdf((retryState.data as { pdf: PdfPayload }).pdf);
    }
  }, [retryState]);

  const resolvedPdf = retriedPdf ?? pdf;
  const jdGaps = data.jdGaps;
  const completeness = data.completeness;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {data.pdfBlocked && generationId && (
        <div style={{ padding: '14px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--warn-text)', margin: '0 0 8px', fontWeight: 600 }}>
            Generated content looks too sparse for a full CV.
          </p>
          {completeness?.warnings.map((warning) => (
            <p key={warning} style={{ fontSize: '12px', color: 'var(--warn-text)', margin: '0 0 4px' }}>{warning}</p>
          ))}
          <form action={retryPdfAction} style={{ marginTop: '10px' }}>
            <input type="hidden" name="generationId" value={generationId} />
            <input type="hidden" name="forceExport" value="on" />
            <button type="submit" style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px', border: 'none', background: 'var(--action-btn-bg)', color: 'var(--action-btn-text)', cursor: 'pointer' }}>
              Export PDF anyway
            </button>
          </form>
        </div>
      )}

      {jdGaps?.hasGaps && (
        <div style={{ padding: '14px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warn-text)', margin: '0 0 8px' }}>
            Job requirements not found in your vault
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '12px', color: 'var(--warn-text)' }}>
            {[...jdGaps.missingMustHave, ...jdGaps.missingInVault].slice(0, 8).map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <Link href="/ingest" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warn-text)' }}>
            Add matching projects in Ingest →
          </Link>
        </div>
      )}

      {data.retrieval && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Retrieval ({data.retrieval.retrievalMode ?? 'vector'}): {data.retrieval.selectedCount}/
          {data.retrieval.candidateCount} projects used
          {typeof data.retrieval.vaultProjectCount === 'number'
            ? ` · vault ${data.retrieval.vaultProjectCount} total`
            : ''}
          {typeof data.retrieval.projectsWithEmbeddings === 'number'
            ? ` · ${data.retrieval.projectsWithEmbeddings} with embeddings`
            : ''}
          {data.retrieval.mustHaveSkillsFilterReduced ? ' (must-have filter relaxed)' : ''}.
        </p>
      )}
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
        </div>
      )}

      {resolvedPdf ? (
        <PdfPreviewPanel pdf={resolvedPdf} />
      ) : pdfError && generationId ? (
        <div style={{ padding: '14px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--warn-text)', margin: '0 0 10px' }}>
            Portfolio generated, but PDF export failed: {pdfError}
          </p>
          <form action={retryPdfAction}>
            <input type="hidden" name="generationId" value={generationId} />
            <button
              type="submit"
              disabled={isPdfRetrying}
              style={{
                fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px',
                border: 'none', background: 'var(--action-btn-bg)', color: 'var(--action-btn-text)',
                cursor: isPdfRetrying ? 'not-allowed' : 'pointer', opacity: isPdfRetrying ? 0.6 : 1,
              }}
            >
              {isPdfRetrying ? 'Building PDF…' : 'Retry PDF export'}
            </button>
          </form>
        </div>
      ) : null}

      {content?.summary && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 8px' }}>Summary</p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, padding: '14px 16px', background: 'var(--summary-bg)', borderRadius: '10px', border: '1px solid var(--summary-border)' }}>
            {content.summary}
          </p>
        </div>
      )}

      {content?.workExperience && content.workExperience.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', margin: '0 0 10px' }}>Work Experience</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {content.workExperience.map((entry, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }}>{entry.role} — {entry.company}</p>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entry.bullets.map((bullet, bi) => (
                    <li key={bi} style={{ fontSize: '13px', color: 'var(--label-color)', lineHeight: 1.5 }}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

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
  preflight,
  generateAction,
  exportPdfAction,
}: {
  preflight: Preflight;
  generateAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  exportPdfAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
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
    <div style={{ padding: '24px 32px', maxWidth: '1280px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: 'var(--text-subtle)', margin: '0 0 6px' }}>Generate</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: 0 }}>
          Portfolio Generator
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-muted)', maxWidth: '560px', lineHeight: 1.5 }}>
          Paste a job description and AI will vector-search your vault, generate a tailored draft, and build a PDF preview automatically.
        </p>
      </div>

      {!preflight.profileCompleteness.isCoreComplete && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--warn-text)', margin: 0 }}>
            Your profile is missing: {preflight.profileCompleteness.missingCore.join(', ')}.{' '}
            <Link href="/profile" style={{ fontWeight: 600, color: 'var(--warn-text)' }}>Complete your profile</Link> for a fuller CV header.
          </p>
        </div>
      )}

      {preflight.vaultProjectCount === 0 && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--danger-text)', margin: 0 }}>
            Your vault is empty. <Link href="/ingest" style={{ fontWeight: 600 }}>Add projects</Link> before generating.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '24px', alignItems: 'flex-start' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
                Output format
                <select name="outputFormat" defaultValue="sections" style={inputStyle}>
                  <option value="sections">Sections</option>
                  <option value="resume">Resume</option>
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--label-color)' }}>
                Top matches
                <input name="topK" type="number" min={1} max={20} defaultValue={8} style={inputStyle} />
              </label>
            </div>

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

        <div>
          {genState.status === 'idle' && !isPending && (
            <div style={{
              background: 'var(--card-bg)', borderRadius: '16px',
              border: '1px dashed var(--card-border)', padding: '40px 24px',
              textAlign: 'center', color: 'var(--text-subtle)',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>✨</div>
              <p style={{ fontSize: '14px', margin: 0 }}>Your portfolio draft and PDF preview will appear here</p>
            </div>
          )}

          {isPending && (
            <div style={{
              background: 'var(--card-bg)', borderRadius: '16px',
              border: '1px solid var(--card-border)', padding: '40px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>⚙️</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 4px' }}>Generating portfolio{dots}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Searching vault, drafting content, and building PDF…</p>
            </div>
          )}

          {genState.status === 'error' && genState.message && (
            <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '12px', color: 'var(--danger-text)', fontSize: '14px' }}>
              <strong>Error:</strong> {genState.message}
            </div>
          )}

          {result && <GenerationResultDisplay data={result} exportPdfAction={exportPdfAction} />}
        </div>
      </div>
    </div>
  );
}
