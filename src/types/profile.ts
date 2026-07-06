// ─────────────────────────────────────────────────────────────
// Profile shared types
// ─────────────────────────────────────────────────────────────

export const LANGUAGE_PROFICIENCY_LEVELS = [
  'basic',
  'intermediate',
  'advanced',
  'native',
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCY_LEVELS)[number];

export type LanguageEntry = {
  name: string;
  proficiency: LanguageProficiency | '';
};

export type EducationEntry = {
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
  location?: string;
  honors?: string;
  coursework?: string;
};

export type UserProfileData = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  languages: LanguageEntry[];
  education: EducationEntry[];
};
