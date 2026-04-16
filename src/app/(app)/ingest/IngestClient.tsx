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

const StatCard = ({ label, value, color = '#15803d' }: { label: string; value: number; color?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex-1 min-w-[80px]"
  >
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-bold" style={{ color }}>
      {value ?? 0}
    </p>
  </motion.div>
);

const TechBadge = ({ tech }: { tech: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
    {tech}
  </span>
);

const ImpactBadge = ({ score }: { score: number }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
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
        <div className="flex flex-wrap gap-4 pb-3 border-b border-emerald-200">
          <StatCard label="Extracted" value={d.extractedCount || 0} />
          <StatCard label="Quality Accepted" value={d.qualityAcceptedCount || 0} color="#ea580c" />
          <StatCard label="Duplicates Skipped" value={d.duplicateSkippedCount || 0} color="#6b7280" />
          <StatCard label="Inserted" value={d.insertedCount || 0} color="#059669" />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Header extraction: {d.personalInfoExtracted ? '✓ detected' : '○ not detected'}</span>
          <span className="w-px h-3 bg-emerald-200" />
          <span>Profile auto-fill: {d.profileAutoUpdated ? '✓ updated' : '○ no changes'}</span>
        </div>
        
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
          {d.entities.map((e, idx) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-3 bg-white rounded-lg border border-emerald-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1">
                  <span className="font-semibold text-emerald-900">{e.title}</span>
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
        <h4 className="font-bold text-emerald-900 text-lg">{d.title}</h4>
        {d.description && (
          <p className="text-sm text-gray-700 leading-relaxed">{d.description}</p>
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
              <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {d.duplicate && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded-lg text-sm">
            <span>⚠️</span>
            <span>This project was already in your vault (duplicate skipped).</span>
          </div>
        )}
      </motion.div>
    );
  }
  
  return <pre className="text-xs whitespace-pre-wrap overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
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
            ? 'bg-red-50 border-red-200' 
            : 'bg-emerald-50 border-emerald-200'
        }`}
      >
        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
          isError ? 'text-red-700' : 'text-emerald-700'
        }`}>
          {isError ? '❌ Error' : `✓ ${title}`}
        </p>
        {state.message && (
          <p className="text-sm text-red-600 mb-2">{state.message}</p>
        )}
        {!isError && state.data && <ResultContent data={state.data} />}
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
    if (shredProgress < 18) return '📤 Uploading file';
    if (shredProgress < 45) return '🔍 Parsing resume';
    if (shredProgress < 75) return '🧩 Extracting entities';
    return '💾 Embedding and saving';
  }, [isShredPending, shredProgress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600 mb-3">
            Ingest Engine
          </p>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-stone-800 to-amber-800 bg-clip-text text-transparent mb-3">
            Add to Your Vault
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Transform your professional journey into a searchable knowledge base.
            Upload entire resumes or add individual projects with AI-powered structuring.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-stone-200">
          {[
            { id: 'resume', label: '📄 Resume Upload', icon: '📄' },
            { id: 'project', label: '✏️ Single Project', icon: '✏️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-amber-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600"
                />
              )}
            </button>
          ))}
        </div>

        {/* Resume Upload Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'resume' && (
            <motion.div
              key="resume"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-stone-800 mb-2">
                    📄 Resume Upload &amp; Shred
                  </h2>
                  <p className="text-gray-600">
                    Upload your master resume and let AI decompose it into multiple atomic vault entities — 
                    each separately searchable and embeddable.
                  </p>
                </div>

                <form action={shredAction} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-stone-700 mb-2">
                        Resume file
                      </label>
                      <input
                        name="resumeFile"
                        type="file"
                        required
                        accept=".pdf,.txt,.md,.markdown"
                        className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-stone-700 mb-2">
                        Max entities to extract
                      </label>
                      <input
                        name="maxEntities"
                        type="number"
                        min={1}
                        max={30}
                        defaultValue={12}
                        className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isShredPending}
                    className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold rounded-xl hover:from-amber-700 hover:to-amber-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
                    className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-200"
                  >
                    <div className="flex justify-between text-sm font-semibold text-amber-800 mb-2">
                      <span>{shredPhaseLabel}</span>
                      <span>{Math.round(shredProgress)}%</span>
                    </div>
                    <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
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
              className="bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-stone-800 mb-2">
                    ✏️ Add Single Project
                  </h2>
                  <p className="text-gray-600">
                    Paste raw project notes — AI will clean, structure, and embed them into your vault automatically.
                  </p>
                </div>

                <form action={addAction} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">
                      Raw project text
                    </label>
                    <textarea
                      name="rawInput"
                      required
                      rows={6}
                      placeholder="Built a football scouting app with Next.js and MongoDB that reduced scout reporting time by 40%..."
                      className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y font-mono text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">
                      Optional tags (comma separated)
                    </label>
                    <input
                      name="tags"
                      placeholder="next.js, mongodb, analytics, sports-tech"
                      className="w-full px-4 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAddPending}
                    className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
          className="mt-8 text-center text-sm text-gray-500"
        >
          <div className="flex justify-center gap-6 flex-wrap">
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
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}