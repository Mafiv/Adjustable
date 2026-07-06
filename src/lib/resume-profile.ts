import { z } from 'zod';
import {
  LANGUAGE_PROFICIENCY_LEVELS,
  type EducationEntry,
  type LanguageEntry,
  type LanguageProficiency,
} from '@/types/profile';

const languageProficiencySchema = z.enum(LANGUAGE_PROFICIENCY_LEVELS);

export const resumePersonalInfoSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  portfolio: z.string().optional(),
  summary: z.string().optional(),
  languages: z
    .array(
      z.object({
        name: z.string().optional(),
        proficiency: languageProficiencySchema.optional(),
      })
    )
    .optional(),
  education: z
    .array(
      z.object({
        degree: z.string().optional(),
        institution: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        year: z.string().optional(),
        location: z.string().optional(),
        honors: z.string().optional(),
        coursework: z.string().optional(),
      })
    )
    .optional(),
});

export type ResumePersonalInfo = z.infer<typeof resumePersonalInfoSchema>;

export type ResumePersonalHeuristics = {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  languages: LanguageEntry[];
  education: EducationEntry[];
};

export function firstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

const PROFICIENCY_ALIASES: Record<string, LanguageProficiency> = {
  native: 'native',
  'mother tongue': 'native',
  'mother-tongue': 'native',
  fluent: 'advanced',
  fluency: 'advanced',
  proficient: 'advanced',
  professional: 'advanced',
  bilingual: 'advanced',
  advanced: 'advanced',
  upper: 'advanced',
  intermediate: 'intermediate',
  conversational: 'intermediate',
  working: 'intermediate',
  basic: 'basic',
  elementary: 'basic',
  beginner: 'basic',
  limited: 'basic',
};

export function normalizeProficiency(raw: string | undefined | null): LanguageProficiency | '' {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '';
  if ((LANGUAGE_PROFICIENCY_LEVELS as readonly string[]).includes(value)) {
    return value as LanguageProficiency;
  }
  for (const [alias, level] of Object.entries(PROFICIENCY_ALIASES)) {
    if (value === alias || value.includes(alias)) return level;
  }
  return '';
}

function parseLanguagePart(part: string): LanguageEntry | null {
  const cleaned = part.replace(/^[\-\u2022•]\s*/, '').trim();
  if (!cleaned) return null;

  const parenMatch = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      proficiency: normalizeProficiency(parenMatch[2]),
    };
  }

  const dashMatch = cleaned.match(/^(.+?)\s*[-–:]\s*(.+)$/);
  if (dashMatch) {
    const maybeProficiency = normalizeProficiency(dashMatch[2]);
    if (maybeProficiency) {
      return { name: dashMatch[1].trim(), proficiency: maybeProficiency };
    }
  }

  const trailingProficiency = cleaned.match(
    /^(.+?)\s+(native|fluent|basic|intermediate|advanced|bilingual|proficient|conversational)$/i
  );
  if (trailingProficiency) {
    return {
      name: trailingProficiency[1].trim(),
      proficiency: normalizeProficiency(trailingProficiency[2]),
    };
  }

  return { name: cleaned, proficiency: '' };
}

/** Parse comma/newline-separated language text into structured entries. */
export function parseLanguagesFromText(raw: string): LanguageEntry[] {
  if (!raw.trim()) return [];

  const seen = new Set<string>();
  const entries: LanguageEntry[] = [];

  for (const part of raw.split(/[,;|\n]+/)) {
    const parsed = parseLanguagePart(part);
    if (!parsed?.name) continue;
    const key = parsed.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(parsed);
  }

  return entries;
}

export function normalizeLanguageEntries(input: unknown): LanguageEntry[] {
  if (Array.isArray(input)) {
    const entries: LanguageEntry[] = [];
    const seen = new Set<string>();

    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const record = item as { name?: string; proficiency?: string };
      const name = String(record.name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        name,
        proficiency: normalizeProficiency(record.proficiency),
      });
    }

    return entries;
  }

  if (typeof input === 'string') {
    return parseLanguagesFromText(input);
  }

  return [];
}

export function formatLanguagesForDisplay(languages: LanguageEntry[]): string {
  return languages
    .filter((entry) => entry.name.trim())
    .map((entry) => {
      const name = entry.name.trim();
      if (!entry.proficiency) return name;
      const label = entry.proficiency.charAt(0).toUpperCase() + entry.proficiency.slice(1);
      return `${name} (${label})`;
    })
    .join(', ');
}

function normalizeEducationEntry(input: {
  degree?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
  year?: string;
  location?: string;
  honors?: string;
  coursework?: string;
}): EducationEntry {
  const startDate = firstNonEmpty(input.startDate);
  const endDate = firstNonEmpty(input.endDate, input.year);

  return {
    degree: firstNonEmpty(input.degree),
    institution: firstNonEmpty(input.institution),
    startDate,
    endDate,
    location: firstNonEmpty(input.location),
    honors: firstNonEmpty(input.honors),
    coursework: firstNonEmpty(input.coursework),
  };
}

export function normalizeEducationEntries(input: unknown): EducationEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry) =>
      normalizeEducationEntry(
        (entry ?? {}) as {
          degree?: string;
          institution?: string;
          startDate?: string;
          endDate?: string;
          year?: string;
          location?: string;
          honors?: string;
          coursework?: string;
        }
      )
    )
    .filter(
      (entry) =>
        entry.degree ||
        entry.institution ||
        entry.startDate ||
        entry.endDate ||
        entry.honors ||
        entry.coursework
    );
}

export function formatEducationDateRange(startDate: string, endDate: string): string {
  const start = startDate.trim();
  const end = endDate.trim();
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

export function buildResumeExtractionPrompt(resumeText: string) {
  return [
    'Extract personal information from this resume text.',
    'Infer the candidate name from the resume header even if the label "full name" is not explicitly written.',
    'IMPORTANT: Return the name as a clean full name only — no job titles, no extra words. Example: "Abdi Sileshi Worku", NOT "Abdi Sileshi Worku Software".',
    'Prioritize contact/header details: name, title, email, phone, location, linkedin, github, portfolio.',
    'Extract the professional summary / bio from sections titled Summary, Profile, About, or Bio.',
    'Extract languages as an array of objects with name and proficiency.',
    'Proficiency must be one of: basic, intermediate, advanced, native.',
    'Map synonyms when needed: fluent/proficient/bilingual → advanced, conversational → intermediate, mother tongue → native.',
    'Return only the information that is explicitly present in the resume.',
    'For phone numbers, normalize to international format with spaces: e.g. "+251 988 734 632".',
    'For education, extract every degree/program with institution, start date, end date (or graduation year), location, honors (GPA, dean\'s list, etc.), and relevant coursework.',
    'Use startDate and endDate as strings (e.g. "2018", "Sep 2020", "Present"). Put graduation year in endDate when only one year is shown.',
    'IMPORTANT: Fix common typos in education data — e.g. "unversity" → "University", "Engginering" → "Engineering".',
    'For links (linkedin, github, portfolio), return the full URL when available.',
    `Resume:\n${resumeText.slice(0, 15000)}`,
  ].join('\n');
}

function mergeEducationEntries(existing: EducationEntry[], extracted: EducationEntry[]) {
  if (existing.length === 0) return extracted;
  if (extracted.length === 0) return existing;

  return existing.map((entry, index) => {
    const match =
      extracted[index] ??
      extracted.find(
        (candidate) =>
          candidate.institution &&
          entry.institution &&
          candidate.institution.toLowerCase() === entry.institution.toLowerCase()
      );

    return {
      degree: firstNonEmpty(entry.degree, match?.degree),
      institution: firstNonEmpty(entry.institution, match?.institution),
      startDate: firstNonEmpty(entry.startDate, match?.startDate),
      endDate: firstNonEmpty(entry.endDate, match?.endDate),
      location: firstNonEmpty(entry.location, match?.location),
      honors: firstNonEmpty(entry.honors, match?.honors),
      coursework: firstNonEmpty(entry.coursework, match?.coursework),
    };
  });
}

function coalesceLanguageProficiency(
  ...values: Array<LanguageProficiency | '' | string | undefined | null>
): LanguageProficiency | '' {
  for (const value of values) {
    if (!value) continue;
    if ((LANGUAGE_PROFICIENCY_LEVELS as readonly string[]).includes(String(value))) {
      return value as LanguageProficiency;
    }
    const normalized = normalizeProficiency(value);
    if (normalized) return normalized;
  }
  return '';
}

function mergeLanguageEntries(existing: LanguageEntry[], extracted: LanguageEntry[]): LanguageEntry[] {
  if (existing.length === 0) return extracted;
  if (extracted.length === 0) return existing;

  const byName = new Map(extracted.map((entry) => [entry.name.toLowerCase(), entry]));
  const merged = existing.map((entry) => {
    const match = byName.get(entry.name.toLowerCase());
    return {
      name: firstNonEmpty(entry.name, match?.name),
      proficiency: coalesceLanguageProficiency(entry.proficiency, match?.proficiency),
    };
  });

  const seen = new Set(merged.map((entry) => entry.name.toLowerCase()));
  for (const entry of extracted) {
    const key = entry.name.toLowerCase();
    if (entry.name && !seen.has(key)) {
      merged.push(entry);
      seen.add(key);
    }
  }

  return merged;
}

export function mergeResumeIntoProfile(input: {
  existing?: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    summary?: string;
    languages?: unknown;
    education?: unknown;
  } | null;
  personalInfo?: ResumePersonalInfo | null;
  heuristics: ResumePersonalHeuristics;
  heuristicsOnly?: boolean;
}) {
  const { existing, personalInfo, heuristics, heuristicsOnly = false } = input;

  const existingEducation = normalizeEducationEntries(existing?.education);
  const extractedEducation = heuristicsOnly
    ? []
    : normalizeEducationEntries(personalInfo?.education);
  const heuristicEducation = heuristics.education ?? [];

  const mergedEducation = mergeEducationEntries(
    mergeEducationEntries(existingEducation, extractedEducation),
    heuristicEducation
  );

  const existingLanguages = normalizeLanguageEntries(existing?.languages);
  const extractedLanguages = heuristicsOnly
    ? []
    : normalizeLanguageEntries(personalInfo?.languages);
  const heuristicLanguages = heuristics.languages ?? [];

  const mergedLanguages = mergeLanguageEntries(
    mergeLanguageEntries(existingLanguages, extractedLanguages),
    heuristicLanguages
  );

  return {
    name: firstNonEmpty(existing?.name, heuristicsOnly ? undefined : personalInfo?.name, heuristics.name),
    title: firstNonEmpty(existing?.title, heuristicsOnly ? undefined : personalInfo?.title, heuristics.title),
    email: firstNonEmpty(existing?.email, heuristicsOnly ? undefined : personalInfo?.email, heuristics.email),
    phone: firstNonEmpty(existing?.phone, heuristicsOnly ? undefined : personalInfo?.phone, heuristics.phone),
    location: firstNonEmpty(
      existing?.location,
      heuristicsOnly ? undefined : personalInfo?.location
    ),
    linkedin: firstNonEmpty(
      existing?.linkedin,
      heuristicsOnly ? undefined : personalInfo?.linkedin,
      heuristics.linkedin
    ),
    github: firstNonEmpty(
      existing?.github,
      heuristicsOnly ? undefined : personalInfo?.github,
      heuristics.github
    ),
    portfolio: firstNonEmpty(
      existing?.portfolio,
      heuristicsOnly ? undefined : personalInfo?.portfolio,
      heuristics.portfolio
    ),
    summary: firstNonEmpty(
      existing?.summary,
      heuristicsOnly ? undefined : personalInfo?.summary,
      heuristics.summary
    ),
    languages: mergedLanguages,
    education: mergedEducation,
  };
}

export function hasAnyMergedProfileValue(profile: ReturnType<typeof mergeResumeIntoProfile>) {
  return (
    Boolean(profile.name) ||
    Boolean(profile.title) ||
    Boolean(profile.email) ||
    Boolean(profile.phone) ||
    Boolean(profile.location) ||
    Boolean(profile.linkedin) ||
    Boolean(profile.github) ||
    Boolean(profile.portfolio) ||
    Boolean(profile.summary) ||
    profile.languages.length > 0 ||
    profile.education.length > 0
  );
}

const RESUME_FIELD_CHECKS: Array<{
  key: 'summary' | 'github' | 'languages';
  label: string;
  hasValue: (input: {
    personalInfo?: ResumePersonalInfo | null;
    heuristics: ResumePersonalHeuristics;
  }) => boolean;
}> = [
  {
    key: 'summary',
    label: 'Bio / professional summary',
    hasValue: ({ personalInfo, heuristics }) =>
      Boolean(personalInfo?.summary?.trim() || heuristics.summary?.trim()),
  },
  {
    key: 'github',
    label: 'GitHub',
    hasValue: ({ personalInfo, heuristics }) =>
      Boolean(personalInfo?.github?.trim() || heuristics.github?.trim()),
  },
  {
    key: 'languages',
    label: 'Languages',
    hasValue: ({ personalInfo, heuristics }) =>
      normalizeLanguageEntries(personalInfo?.languages).length > 0 ||
      (heuristics.languages?.length ?? 0) > 0,
  },
];

export function getResumeFieldsNotInCv(input: {
  personalInfo?: ResumePersonalInfo | null;
  heuristics: ResumePersonalHeuristics;
}) {
  const missing: string[] = [];

  for (const { label, hasValue } of RESUME_FIELD_CHECKS) {
    if (!hasValue(input)) {
      missing.push(label);
    }
  }

  return missing;
}
