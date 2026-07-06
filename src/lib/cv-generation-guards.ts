type LooseGenerationOutput = {
  summary?: string;
  workExperience?: Array<{
    company?: string;
    role?: string;
    bullets?: string[];
  }>;
  projects?: Array<{
    title?: string;
    description?: string;
    bullets?: string[];
  }>;
  sections?: Array<{
    title?: string;
    bullets?: string[];
  }>;
};

const REFUSAL_PATTERNS = [
  /no matched vault projects/i,
  /no matching projects/i,
  /no projects (were )?found/i,
  /no relevant projects/i,
  /could not find (any )?projects/i,
  /i (would )?need (more )?(data|information)/i,
  /here(?:'s| is) what (data|information) i/i,
  /please provide/i,
  /cannot generate/i,
  /unable to (create|generate|produce)/i,
  /insufficient (source|data|information|context)/i,
  /not enough (source|data|information|projects)/i,
  /without (additional|more) (data|information|projects)/i,
  /lack(?:s|ing) (source|vault|project)/i,
];

export function isRefusalOrMetaText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function findRefusalTexts(output: LooseGenerationOutput) {
  const hits: string[] = [];

  const inspect = (label: string, value?: string) => {
    if (value && isRefusalOrMetaText(value)) hits.push(`${label}: ${value.slice(0, 120)}`);
  };

  inspect('summary', output.summary);

  for (const entry of output.workExperience ?? []) {
    inspect('workExperience.company', entry.company);
    inspect('workExperience.role', entry.role);
    for (const bullet of entry.bullets ?? []) inspect('workExperience.bullet', bullet);
  }

  for (const project of output.projects ?? []) {
    inspect('projects.title', project.title);
    inspect('projects.description', project.description);
    for (const bullet of project.bullets ?? []) inspect('projects.bullet', bullet);
  }

  for (const section of output.sections ?? []) {
    inspect('sections.title', section.title);
    for (const bullet of section.bullets ?? []) inspect('sections.bullet', bullet);
  }

  return hits;
}

export function rawOutputLooksLikeRefusal(output: LooseGenerationOutput) {
  return findRefusalTexts(output).length > 0;
}

export function stripRefusalText(text: string) {
  if (isRefusalOrMetaText(text)) return '';
  return text.trim();
}
