const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'with',
  'for',
  'from',
  'that',
  'this',
  'your',
  'our',
  'you',
  'are',
  'will',
  'have',
  'has',
  'using',
  'used',
  'experience',
  'years',
  'year',
  'role',
  'team',
  'work',
  'ability',
  'strong',
  'plus',
  'including',
  'required',
  'preferred',
  'must',
  'should',
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/ ]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function normalizeSkillToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\-]/g, '');
}

export function extractJobRequirementTokens(jobDescription: string, keywords: string[] = []) {
  const fromDescription = tokenize(jobDescription);
  const fromKeywords = keywords.flatMap((keyword) => tokenize(keyword));
  return Array.from(new Set([...fromDescription, ...fromKeywords])).slice(0, 40);
}

export function vaultHasSkillMatch(
  requirement: string,
  vaultTokens: Set<string>
) {
  const normalized = normalizeSkillToken(requirement);
  if (!normalized) return false;

  for (const token of vaultTokens) {
    if (token === normalized) return true;
    if (token.includes(normalized) || normalized.includes(token)) return true;
  }
  return false;
}

export function buildVaultSkillIndex(
  projects: Array<{ techStack?: string[]; tags?: string[]; title?: string; description?: string }>
) {
  const tokens = new Set<string>();

  for (const project of projects) {
    for (const value of [
      ...(project.techStack ?? []),
      ...(project.tags ?? []),
      project.title ?? '',
      project.description ?? '',
    ]) {
      for (const token of tokenize(value)) {
        tokens.add(normalizeSkillToken(token));
      }
    }
  }

  return tokens;
}

export function detectJobDescriptionGaps(input: {
  jobDescription: string;
  keywords?: string[];
  mustHaveSkills?: string[];
  vaultProjects: Array<{ techStack?: string[]; tags?: string[]; title?: string; description?: string }>;
}) {
  const vaultTokens = buildVaultSkillIndex(input.vaultProjects);
  const requirementTokens = extractJobRequirementTokens(
    input.jobDescription,
    [...(input.keywords ?? []), ...(input.mustHaveSkills ?? [])]
  );

  const missingInVault = requirementTokens
    .filter((token) => !vaultHasSkillMatch(token, vaultTokens))
    .slice(0, 12);

  const missingMustHave = (input.mustHaveSkills ?? [])
    .map((skill) => skill.trim())
    .filter(Boolean)
    .filter((skill) => !vaultHasSkillMatch(skill, vaultTokens));

  return {
    missingInVault,
    missingMustHave,
    hasGaps: missingInVault.length > 0 || missingMustHave.length > 0,
  };
}

export function projectMatchesMustHaveSkills(
  project: { techStack?: string[]; tags?: string[] },
  mustHaveSkills: string[]
) {
  if (mustHaveSkills.length === 0) return true;

  const projectTokens = buildVaultSkillIndex([project]);
  return mustHaveSkills.every((skill) => vaultHasSkillMatch(skill, projectTokens));
}
