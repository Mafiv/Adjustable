import {
  formatLanguagesForDisplay,
  formatEducationDateRange,
  normalizeEducationEntries,
  normalizeLanguageEntries,
} from '@/lib/resume-profile';
import type { EducationEntry, LanguageEntry } from '@/types/profile';

export type CvProfile = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  languages: LanguageEntry[];
  education: EducationEntry[];
};

export type ProfileFieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'summary'
  | 'education'
  | 'languages';

export const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, string> = {
  name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  location: 'Location',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio / website',
  summary: 'Professional summary',
  education: 'Education',
  languages: 'Languages',
};

const CORE_PROFILE_FIELDS: ProfileFieldKey[] = [
  'name',
  'email',
  'phone',
  'location',
  'linkedin',
  'github',
  'portfolio',
  'summary',
  'education',
];

const OPTIONAL_PROFILE_FIELDS: ProfileFieldKey[] = ['languages'];

export function normalizeCvProfile(input: Partial<CvProfile> | null | undefined): CvProfile {
  return {
    name: String(input?.name ?? '').trim(),
    title: String(input?.title ?? '').trim(),
    email: String(input?.email ?? '').trim(),
    phone: String(input?.phone ?? '').trim(),
    location: String(input?.location ?? '').trim(),
    linkedin: String(input?.linkedin ?? '').trim(),
    github: String(input?.github ?? '').trim(),
    portfolio: String(input?.portfolio ?? '').trim(),
    summary: String(input?.summary ?? '').trim(),
    languages: normalizeLanguageEntries(input?.languages),
    education: normalizeEducationEntries(input?.education),
  };
}

export { formatLanguagesForDisplay, formatEducationDateRange };

type StringProfileField = Exclude<ProfileFieldKey, 'education' | 'languages'>;

function readStringField(profile: CvProfile, field: StringProfileField) {
  return profile[field].trim();
}

export function getMissingProfileFields(profile: CvProfile) {
  const missingCore: ProfileFieldKey[] = [];
  const missingOptional: ProfileFieldKey[] = [];

  for (const field of CORE_PROFILE_FIELDS) {
    if (field === 'education') {
      if (profile.education.length === 0) missingCore.push(field);
      continue;
    }
    if (!readStringField(profile, field as StringProfileField)) missingCore.push(field);
  }

  for (const field of OPTIONAL_PROFILE_FIELDS) {
    if (field === 'languages') {
      if (profile.languages.length === 0) missingOptional.push(field);
      continue;
    }
    if (!readStringField(profile, field as StringProfileField)) missingOptional.push(field);
  }

  return { missingCore, missingOptional };
}

export function getProfileCompletenessSummary(profile: CvProfile) {
  const { missingCore, missingOptional } = getMissingProfileFields(profile);
  return {
    missingCore: missingCore.map((key) => PROFILE_FIELD_LABELS[key]),
    missingOptional: missingOptional.map((key) => PROFILE_FIELD_LABELS[key]),
    isCoreComplete: missingCore.length === 0,
  };
}

export function hasLanguageProficiency(languages: LanguageEntry[]) {
  return languages.some((entry) => Boolean(entry.proficiency));
}
