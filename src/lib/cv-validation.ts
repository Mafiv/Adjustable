import type { GenerationOutput } from '@/lib/cv-generation';
import { countGenerationBullets } from '@/lib/cv-generation';
import { isRefusalOrMetaText } from '@/lib/cv-generation-guards';

export type GenerationCompletenessResult = {
  ok: boolean;
  blocked: boolean;
  warnings: string[];
  metrics: {
    matchedProjects: number;
    workExperienceCount: number;
    projectCount: number;
    sectionCount: number;
    totalBullets: number;
    skillCategoryCount: number;
  };
};

export function validateGenerationCompleteness(input: {
  content: GenerationOutput;
  matchedProjectCount: number;
  strict?: boolean;
  refusalDetected?: boolean;
}): GenerationCompletenessResult {
  const { content, matchedProjectCount, refusalDetected = false } = input;
  const totalBullets = countGenerationBullets(content);
  const warnings: string[] = [];

  const metrics = {
    matchedProjects: matchedProjectCount,
    workExperienceCount: content.workExperience.length,
    projectCount: content.projects.length,
    sectionCount: content.sections.length,
    totalBullets,
    skillCategoryCount: content.skillCategories?.length ?? 0,
  };

  if (matchedProjectCount === 0) {
    warnings.push('No vault projects were matched for this job description.');
  }

  if (refusalDetected || isRefusalOrMetaText(content.summary)) {
    warnings.push('Generated content includes meta/error text instead of grounded CV content.');
  }

  if (matchedProjectCount >= 3 && content.workExperience.length < 2) {
    warnings.push(
      `Only ${content.workExperience.length} work experience entries for ${matchedProjectCount} matched projects.`
    );
  }

  if (matchedProjectCount >= 2 && totalBullets < matchedProjectCount * 2) {
    warnings.push(
      `Sparse bullet coverage (${totalBullets} bullets for ${matchedProjectCount} matched projects).`
    );
  }

  if ((content.skillCategories?.length ?? 0) === 0 && content.keywords.length < 3) {
    warnings.push('Skills section is thin — few keywords or skill categories were produced.');
  }

  const hasGroundedContent =
    matchedProjectCount > 0 &&
    !refusalDetected &&
    !isRefusalOrMetaText(content.summary) &&
    totalBullets >= Math.min(Math.max(matchedProjectCount, 2), 6) &&
    content.workExperience.length >= 1;

  const ok =
    !input.strict ||
    (matchedProjectCount < 2
      ? totalBullets >= 2 && !refusalDetected
      : hasGroundedContent);

  const blocked =
    input.strict === true &&
    (matchedProjectCount === 0 || refusalDetected || !hasGroundedContent);

  return { ok, blocked, warnings, metrics };
}
