'use client';

import { useActionState, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  profileFieldsNotInResume?: string[];
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

const StatCard = ({ label, value, color = 'var(--success-text)' }: { label: string; value: number | string; color?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-1 min-w-[80px]"
  >
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] mb-1">{label}</p>
    <p className="text-2xl font-bold" style={{ color }}>
      {value ?? 0}
    </p>
  </motion.div>
);

const TechBadge = ({ tech }: { tech: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--chip-border)]">
    {tech}
  </span>
);

const ImpactBadge = ({ score }: { score: number }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]">
    ⚡ {score}
  </span>
);

function ResultContent({ data }: { data: unknown }) {
  const d = data as ShredResult & AddResult;
  
  if (d.entities && Array.isArray(d.entities)) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap gap-4 pb-3 border-b border-[var(--card-border)]">
          <StatCard label="Extracted" value={d.extractedCount || 0} color="var(--text-strong)" />
          <StatCard label="Accepted" value={d.qualityAcceptedCount || 0} color="var(--brand-600)" />
          <StatCard label="Skipped" value={d.duplicateSkippedCount || 0} color="var(--text-muted)" />
          <StatCard label="Inserted" value={d.insertedCount || 0} color="var(--success-text)" />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] bg-[var(--summary-bg)] p-2 rounded-lg border border-[var(--summary-border)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-text)]" />
          <span>Header extraction: {d.personalInfoExtracted ? '✓ detected' : '○ not detected'}</span>
          <span className="w-px h-3 bg-[var(--card-border)]" />
          <span>Profile auto-fill: {d.profileAutoUpdated ? '✓ updated' : '○ no changes'}</span>
        </div>

        {d.profileFieldsNotInResume && d.profileFieldsNotInResume.length > 0 && (
          <div className="text-xs text-[var(--warn-text)] bg-[var(--warn-bg)] border border-[var(--warn-border)] rounded-lg p-3 leading-relaxed">
            <p className="font-semibold m-0 mb-1">Not found in your uploaded CV:</p>
            <p className="m-0">{d.profileFieldsNotInResume.join(', ')}.</p>
            <p className="m-0 mt-1.5">
              Add these on your{' '}
              <a href="/profile" className="underline font-semibold">Profile</a>{' '}
              page for a more complete resume.
            </p>
          </div>
        )}
        
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
          {d.entities.map((e, idx) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1">
                  <span className="font-semibold text-[var(--text-strong)]">{e.title}</span>
                  {e.techStack && e.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {e.techStack.map(tech => (
                        <TechBadge key={tech} tech={tech} />
                      ))}
                    </div>
                  )}
                </div>
                {e.impactScore && <ImpactBadge score={e.impactScore} />}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }
  
  if (d.id) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <h4 className="font-bold text-[var(--text-strong)] text-lg">{d.title}</h4>
        {d.description && (
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">{d.description}</p>
        )}
        {d.techStack && d.techStack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.techStack.map(tech => (
              <TechBadge key={tech} tech={tech} />
            ))}
          </div>
        )}
        {d.tags && d.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.tags.map(tag => (
              <span key={tag} className="text-xs text-[var(--text-subtle)] bg-[var(--summary-bg)] border border-[var(--summary-border)] px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {d.duplicate && (
          <div className="flex items-center gap-2 text-[var(--brand-600)] bg-[var(--chip-bg)] border border-[var(--chip-border)] p-2 rounded-lg text-sm">
            <span>⚠️</span>
            <span>This project was already in your vault (duplicate skipped).</span>
          </div>
        )}
      </motion.div>
    );
  }
  
  return <pre className="text-xs whitespace-pre-wrap overflow-auto p-3 bg-[var(--summary-bg)] rounded-lg border border-[var(--summary-border)] text-[var(--text-muted)]">{JSON.stringify(data, null, 2)}</pre>;
}

function ResultPanel({ state, title }: { state: ActionState; title: string }) {
  if (state.status === 'idle') return null;
  const isError = state.status === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={`mt-5 rounded-xl border p-4 ${
          isError 
            ? 'bg-[var(--danger-bg)] border-[var(--danger-border)]' 
            : 'bg-[var(--success-bg)] border-[var(--success-border)]'
        }`}
      >
        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
          isError ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'
        }`}>
          {isError ? '❌ Error' : `✓ ${title}`}
        </p>
        {state.message && (
          <p className="text-sm text-[var(--danger-text)] mb-2 opacity-90">{state.message}</p>
        )}
        {!isError && !!state.data && <ResultContent data={state.data} />}
      </motion.div>
    </AnimatePresence>
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
  const [addState, addAction, isAddPending] = useActionState(addProjectAction, init);
  const [shredProgress, setShredProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'resume' | 'project'>('resume');

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
    if (shredProgress < 12) return '📤 Uploading file';
    if (shredProgress < 28) return '📄 Extracting resume text';
    if (shredProgress < 55) return '🤖 AI: vault entities + profile (parallel)';
    if (shredProgress < 78) return '🧬 Batch embedding vault entries';
    return '💾 Saving to your vault';
  }, [isShredPending, shredProgress]);

  return (
    <div className="min-h-screen bg-[var(--app-main-bg)]">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--brand-600)] mb-3">
            Ingest Engine
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-strong)] mb-3">
            Add to Your Vault
          </h1>
          <p className="text-[var(--text-muted)] max-w-2xl mx-auto">
            Transform your professional journey into a searchable knowledge base.
            Upload entire resumes or add individual projects with AI-powered structuring.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-[var(--card-border)]">
          {[
            { id: 'resume', label: '📄 Resume Upload', icon: '📄' },
            { id: 'project', label: '✏️ Single Project', icon: '✏️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'resume' | 'project')}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-[var(--brand-600)]'
                  : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-600)]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'resume' && (
            <motion.div
              key="resume"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--card-border)] overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-strong)] mb-2">
                    📄 Resume Upload &amp; Shred
                  </h2>
                  <p className="text-[var(--text-muted)] font-medium">
                    Upload your master resume and let AI decompose it into multiple atomic vault entities — 
                    each separately searchable and embeddable.
                  </p>
                </div>

                <form action={shredAction} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--label-color)] mb-2">
                        Resume file
                      </label>
                      <input
                        name="resumeFile"
                        type="file"
                        required
                        accept=".pdf,.txt,.md,.markdown"
                        className="w-full px-4 py-2 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-[var(--brand-600)] focus:border-transparent transition-all file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--chip-bg)] file:text-[var(--chip-text)] hover:file:bg-[var(--summary-bg)] bg-[var(--input-bg)] color-[var(--input-text)]"
                      />
                      <p className="mt-2 text-xs text-[var(--text-subtle)] leading-relaxed">
                        PDF, TXT, or Markdown up to 10 MB. Text-based PDFs work best; scanned image PDFs may fail.
                        Processing usually takes 30–90 seconds while AI extracts your vault and profile.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--label-color)] mb-2">
                        Max entities to extract
                      </label>
                      <input
                        name="maxEntities"
                        type="number"
                        min={1}
                        max={30}
                        defaultValue={12}
                        className="w-full px-4 py-2 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-[var(--brand-600)] focus:border-transparent bg-[var(--input-bg)] text-[var(--input-text)]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isShredPending}
                    className="w-full md:w-auto px-8 py-3 bg-[var(--action-btn-bg)] text-[var(--action-btn-text)] font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isShredPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Upload and shred resume'
                    )}
                  </button>
                </form>

                {isShredPending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 p-4 bg-[var(--summary-bg)] rounded-xl border border-[var(--summary-border)]"
                  >
                    <div className="flex justify-between text-sm font-semibold text-[var(--text-muted)] mb-2">
                      <span>{shredPhaseLabel}</span>
                      <span>{Math.round(shredProgress)}%</span>
                    </div>
                    <div className="h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[var(--brand-600)]"
                        initial={{ width: '0%' }}
                        animate={{ width: `${Math.max(2, Math.round(shredProgress))}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}

                <ResultPanel state={shredState} title="Entities extracted and saved" />
              </div>
            </motion.div>
          )}

          {/* Add Project Section */}
          {activeTab === 'project' && (
            <motion.div
              key="project"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--card-border)] overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-[var(--text-strong)] mb-2">
                    ✏️ Add Single Project
                  </h2>
                  <p className="text-[var(--text-muted)] font-medium">
                    Paste raw project notes — AI will clean, structure, and embed them into your vault automatically.
                  </p>
                </div>

                <form action={addAction} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--label-color)] mb-2">
                      Raw project text
                    </label>
                    <textarea
                      name="rawInput"
                      required
                      rows={6}
                      placeholder="Built a football scouting app with Next.js and MongoDB that reduced scout reporting time by 40%..."
                      className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-[var(--brand-600)] focus:border-transparent resize-y font-mono text-sm bg-[var(--input-bg)] text-[var(--input-text)]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-[var(--label-color)] mb-2">
                      Optional tags (comma separated)
                    </label>
                    <input
                      name="tags"
                      placeholder="next.js, mongodb, analytics, sports-tech"
                      className="w-full px-4 py-2 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-[var(--brand-600)] focus:border-transparent bg-[var(--input-bg)] text-[var(--input-text)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAddPending}
                    className="w-full md:w-auto px-8 py-3 bg-[var(--action-btn-bg)] text-[var(--action-btn-text)] font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isAddPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Ingest project into vault'
                    )}
                  </button>
                </form>

                <ResultPanel state={addState} title="Project saved to vault" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-sm text-[var(--text-subtle)]"
        >
          <div className="flex justify-center gap-6 flex-wrap font-medium">
            <span className="flex items-center gap-1">🔒 End-to-end encrypted</span>
            <span className="flex items-center gap-1">🤖 AI-powered extraction</span>
            <span className="flex items-center gap-1">⚡ Real-time processing</span>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--card-border);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-subtle);
        }
      `}</style>
    </div>
  );
}