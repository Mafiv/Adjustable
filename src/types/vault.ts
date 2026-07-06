// ─────────────────────────────────────────────────────────────
// Vault shared types
// ─────────────────────────────────────────────────────────────

export type VaultProject = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  tags: string[];
  impactScore: number;
  createdAt?: string | Date | null;
};

export type AtomicEntity = {
  title: string;
  description: string;
  techStack: string[];
  tags: string[];
  impactScore: number;
};

export type SkillCategory = {
  category: string;
  skills: string[];
};

export type GenerationSource = {
  projectId: string;
  evidence: string;
};

export type GenerationSection = {
  title: string;
  bullets: string[];
};

export type GenerationOutput = {
  summary: string;
  sections: GenerationSection[];
  resumeBullets?: string[];
  markdown?: string;
  keywords: string[];
  skillCategories?: SkillCategory[];
  sources: GenerationSource[];
  rationale?: string[];
};

export type AddProjectResult = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  tags: string[];
  impactScore: number;
  duplicate: boolean;
};

export type ShredResumeResult = {
  extractionMode: 'llm' | 'heuristic';
  extractedCount: number;
  qualityAcceptedCount: number;
  duplicateSkippedCount: number;
  insertedCount: number;
  entities: Array<{
    id: string;
    title: string;
    techStack: string[];
    tags: string[];
    impactScore: number;
  }>;
  personalInfoExtracted: boolean;
  profileAutoUpdated: boolean;
};

export type GeneratePortfolioResult = {
  generationId: string;
  format: string;
  content: GenerationOutput;
};

export type ExportPdfResult = {
  fileName: string;
  base64: string;
};

export type FeedbackEventType =
  | 'view'
  | 'edit'
  | 'export_pdf'
  | 'apply'
  | 'positive'
  | 'negative';
