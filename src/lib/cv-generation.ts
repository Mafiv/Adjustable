import { z } from 'zod';
import { isRefusalOrMetaText, stripRefusalText } from '@/lib/cv-generation-guards';

export const skillCategorySchema = z.object({
  category: z.string(),
  skills: z.array(z.string()),
});

export const workExperienceEntrySchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().optional(),
  dates: z.string().optional(),
  bullets: z.array(z.string()),
});

export const projectEntrySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

export const generationOutputSchema = z.object({
  summary: z.string(),
  workExperience: z.array(workExperienceEntrySchema),
  projects: z.array(projectEntrySchema),
  sections: z.array(
    z.object({
      title: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  resumeBullets: z.array(z.string()).optional(),
  markdown: z.string().optional(),
  keywords: z.array(z.string()),
  skillCategories: z.array(skillCategorySchema).optional(),
  sources: z.array(
    z.object({
      projectId: z.string(),
      evidence: z.string(),
    })
  ),
  rationale: z.array(z.string()).optional(),
});

export const generationOutputLooseSchema = z.object({
  summary: z.string().optional(),
  workExperience: z.array(workExperienceEntrySchema.partial()).optional(),
  projects: z.array(projectEntrySchema.partial()).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().optional(),
        bullets: z.array(z.string()).optional(),
      })
    )
    .optional(),
  resumeBullets: z.array(z.string()).optional(),
  markdown: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  skillCategories: z.array(skillCategorySchema.partial()).optional(),
  sources: z
    .array(
      z.object({
        projectId: z.string().optional(),
        evidence: z.string().optional(),
      })
    )
    .optional(),
  rationale: z.array(z.string()).optional(),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;

type SelectedProject = {
  _id: { toString: () => string };
  title: string;
  description: string;
  techStack?: string[];
  tags?: string[];
};

export function buildGenerationPrompt(input: {
  jobDescription: string;
  outputFormat: string;
  tone?: string;
  audience?: string;
  mustHaveSkills: string[];
  includeRationale: boolean;
  projects: Array<{
    id: string;
    title: string;
    description: string;
    techStack: string[];
    impactScore: number;
    tags: string[];
  }>;
}) {
  const minSections = Math.min(Math.max(input.projects.length, 3), 8);
  const minBullets = 3;

  const projectCount = input.projects.length;

  return [
    'You are an expert resume designer and ATS optimization specialist.',
    projectCount > 0
      ? `You have been given ${projectCount} matched vault projects below. You MUST ground the CV in these projects.`
      : 'No vault projects were provided — return empty arrays for workExperience and projects.',
    'Generate a job-specific, ATS-optimized CV draft using ONLY the provided vault projects.',
    '',
    '### CORE RULES',
    '- Ground every claim in the provided projects. Do NOT invent employers, dates, tools, or metrics.',
    '- NEVER say that no projects were found, that you need more data, or ask the user to provide information.',
    '- NEVER include meta-commentary, apologies, or instructions to the user in any field.',
    '- Use strong action verbs and quantify outcomes only when supported by project descriptions.',
    '- Produce enough content to fill a professional 1-2 page CV.',
    '',
    projectCount > 0 ? `### MINIMUM OUTPUT REQUIREMENTS` : '',
    projectCount > 0
      ? `- Include at least ${minSections} workExperience entries derived from the matched projects.`
      : '',
    projectCount > 0
      ? `- Include at least ${minBullets} bullet points per workExperience entry where evidence exists.`
      : '',
    projectCount > 0
      ? '- Include a projects array covering remaining matched projects not fully used in workExperience.'
      : '',
    projectCount > 0
      ? '- Include skillCategories grouped using skills from the project tech stacks.'
      : '',
    projectCount > 0 ? '- summary must be 3-5 lines tailored to the job description.' : '',
    '',
    '### OUTPUT JSON SHAPE',
    '{',
    '  "summary": string,',
    '  "workExperience": [{ "company": string, "role": string, "location"?: string, "dates"?: string, "bullets": string[] }],',
    '  "projects": [{ "title": string, "description"?: string, "bullets"?: string[] }],',
    '  "sections": [{ "title": string, "bullets": string[] }],',
    '  "keywords": string[],',
    '  "skillCategories": [{ "category": string, "skills": string[] }],',
    '  "sources": [{ "projectId": string, "evidence": string }],',
    '  "rationale"?: string[]',
    '}',
    '',
    `### JOB DESCRIPTION`,
    input.jobDescription,
    '',
    input.tone ? `Tone: ${input.tone}` : '',
    input.audience ? `Audience: ${input.audience}` : '',
    input.mustHaveSkills.length ? `Must-have skills: ${input.mustHaveSkills.join(', ')}` : '',
    `Output format preference: ${input.outputFormat}`,
    input.includeRationale
      ? 'Include rationale explaining why projects were selected.'
      : '',
    '',
    '### MATCHED VAULT PROJECTS',
    JSON.stringify(input.projects, null, 2),
  ]
    .filter(Boolean)
    .join('\n');
}

const SKILL_CATEGORY_TOKENS: Record<string, string[]> = {
  Frontend: ['react', 'next.js', 'nextjs', 'typescript', 'javascript', 'tailwind', 'vue', 'angular', 'html', 'css'],
  Backend: ['node.js', 'nodejs', 'node', 'nestjs', 'fastapi', 'python', 'express', 'django', 'java', 'spring'],
  Database: ['mongodb', 'postgresql', 'postgres', 'mysql', 'redis', 'sqlite', 'prisma'],
  'AI / Tools': ['n8n', 'openai', 'langchain', 'rag', 'llm', 'embedding', 'vector'],
  'Cloud / DevOps': ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'ci-cd', 'github actions'],
  Engineering: ['git', 'rest', 'graphql', 'api', 'microservices', 'testing', 'jest'],
};

export function buildSkillCategoriesFromProjects(selectedProjects: SelectedProject[]) {
  const allSkills = [
    ...new Set(
      selectedProjects
        .flatMap((project) => [...(project.techStack ?? []), ...(project.tags ?? [])])
        .map((skill) => skill.trim())
        .filter(Boolean)
    ),
  ];

  if (allSkills.length === 0) return [];

  const categorized: Array<{ category: string; skills: string[] }> = [];
  const used = new Set<string>();

  for (const [category, tokens] of Object.entries(SKILL_CATEGORY_TOKENS)) {
    const matched = allSkills.filter((skill) => {
      const lower = skill.toLowerCase();
      return tokens.some((token) => lower.includes(token) || token.includes(lower));
    });
    if (matched.length > 0) {
      matched.forEach((skill) => used.add(skill.toLowerCase()));
      categorized.push({ category, skills: matched });
    }
  }

  const uncategorized = allSkills.filter((skill) => !used.has(skill.toLowerCase()));
  if (uncategorized.length > 0) {
    categorized.push({ category: 'Other', skills: uncategorized });
  }

  return categorized;
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key) || isRefusalOrMetaText(value)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeWorkExperience(
  output: z.infer<typeof generationOutputLooseSchema>,
  selectedProjects: SelectedProject[]
) {
  const fromModel = (output.workExperience ?? [])
    .map((entry) => ({
      company: stripRefusalText(entry.company?.trim() || ''),
      role: stripRefusalText(entry.role?.trim() || ''),
      location: entry.location?.trim() || undefined,
      dates: entry.dates?.trim() || undefined,
      bullets: dedupeStrings((entry.bullets ?? []).map((bullet) => bullet.trim())).slice(0, 8),
    }))
    .filter((entry) => entry.company || entry.role || entry.bullets.length > 0);

  if (fromModel.length > 0) return fromModel;

  const fromSections = (output.sections ?? [])
    .map((section, index) => ({
      company: section.title?.trim() || selectedProjects[index]?.title || `Experience ${index + 1}`,
      role: selectedProjects[index]?.title || section.title?.trim() || 'Contributor',
      bullets: (section.bullets ?? [])
        .map((bullet) => bullet.trim())
        .filter(Boolean)
        .slice(0, 8),
    }))
    .filter((entry) => entry.bullets.length > 0);

  if (fromSections.length > 0) return fromSections;

  return selectedProjects.slice(0, Math.min(selectedProjects.length, 6)).map((project) => ({
    company: project.title,
    role: project.techStack?.[0] ? `${project.techStack[0]} Project` : 'Project Contributor',
    bullets: [
      project.description.slice(0, 220),
      `Technologies: ${(project.techStack ?? []).join(', ') || 'N/A'}`,
    ].filter(Boolean),
  }));
}

function normalizeProjects(
  output: z.infer<typeof generationOutputLooseSchema>,
  selectedProjects: SelectedProject[],
  workExperienceCount: number
) {
  const fromModel = (output.projects ?? [])
    .map((entry) => ({
      title: stripRefusalText(entry.title?.trim() || ''),
      description: stripRefusalText(entry.description?.trim() || '') || undefined,
      bullets: dedupeStrings((entry.bullets ?? []).map((bullet) => bullet.trim())).slice(0, 4),
    }))
    .filter((entry) => entry.title || entry.description || (entry.bullets?.length ?? 0) > 0);

  if (fromModel.length > 0) return fromModel;

  return selectedProjects.slice(workExperienceCount).map((project) => ({
    title: project.title,
    description: project.description.slice(0, 180),
    bullets: [
      `Stack: ${(project.techStack ?? []).join(', ') || 'General engineering'}`,
    ],
  }));
}

export function normalizeGenerationOutput(
  output: z.infer<typeof generationOutputLooseSchema>,
  selectedProjects: SelectedProject[]
): GenerationOutput {
  const firstProject = selectedProjects[0];
  const workExperience = normalizeWorkExperience(output, selectedProjects);
  const projects = normalizeProjects(output, selectedProjects, workExperience.length);

  const workTitles = new Set(
    workExperience.flatMap((entry) => [entry.company, entry.role].map((v) => v.toLowerCase()))
  );

  const sections = (output.sections ?? [])
    .slice(0, 10)
    .map((section, index) => {
      const title =
        stripRefusalText(
          section.title?.trim() ||
            selectedProjects[index]?.title ||
            workExperience[index]?.role ||
            `Section ${index + 1}`
        ) || `Section ${index + 1}`;
      const bullets = dedupeStrings((section.bullets ?? []).map((bullet) => bullet.trim())).slice(0, 8);

      const fallbackBullet =
        selectedProjects[index]?.description?.slice(0, 180) ||
        firstProject?.description?.slice(0, 180) ||
        '';

      return {
        title,
        bullets: bullets.length > 0 ? bullets : fallbackBullet ? [fallbackBullet] : [],
      };
    })
    .filter((section) => section.bullets.length > 0);

  const ensuredSections =
    workExperience.length > 0 || projects.length > 0
      ? []
      : sections.length > 0
        ? sections
        : workExperience.map((entry) => ({
            title: entry.role || entry.company,
            bullets: entry.bullets,
          }));

  const keywordPool = selectedProjects.flatMap((project) => [
    ...(project.techStack ?? []),
    ...(project.tags ?? []),
  ]);
  const keywords = dedupeStrings(
    ((output.keywords?.length ?? 0) > 0 ? output.keywords! : keywordPool).map((keyword) =>
      keyword.trim()
    )
  ).slice(0, 24);

  const sources = (output.sources ?? [])
    .map((source, index) => ({
      projectId:
        source.projectId?.trim() ||
        selectedProjects[index]?._id.toString() ||
        firstProject?._id.toString() ||
        'unknown',
      evidence:
        source.evidence?.trim() ||
        selectedProjects[index]?.description?.slice(0, 220) ||
        firstProject?.description?.slice(0, 220) ||
        'Evidence unavailable.',
    }))
    .slice(0, 20);

  const ensuredSources =
    sources.length > 0
      ? sources
      : selectedProjects.slice(0, 8).map((project) => ({
          projectId: project._id.toString(),
          evidence: project.description.slice(0, 220),
        }));

  const summaryCandidate = stripRefusalText(output.summary?.trim() || '');
  const summary =
    summaryCandidate ||
    (workExperience[0]?.bullets[0] && !isRefusalOrMetaText(workExperience[0].bullets[0])
      ? workExperience[0].bullets[0]
      : '') ||
    firstProject?.description?.slice(0, 240) ||
    'Generated portfolio summary.';

  const resumeBullets = dedupeStrings((output.resumeBullets ?? []).map((bullet) => bullet.trim())).slice(
    0,
    20
  );

  const markdown =
    output.markdown?.trim() ||
    [
      '# Portfolio Summary',
      summary,
      '## Work Experience',
      ...workExperience.flatMap((entry) => [
        `### ${entry.role} — ${entry.company}`,
        ...entry.bullets.map((bullet) => `- ${bullet}`),
      ]),
      '## Projects',
      ...projects
        .filter((project) => !workTitles.has(project.title.toLowerCase()))
        .map((project) => `- **${project.title}**: ${project.description ?? ''}`),
    ].join('\n\n');

  const modelSkillCategories = (output.skillCategories ?? [])
    .filter((cat) => cat.category?.trim() && (cat.skills ?? []).length > 0)
    .map((cat) => ({
      category: cat.category!.trim(),
      skills: dedupeStrings((cat.skills ?? []).map((skill) => skill.trim())),
    }))
    .filter((cat) => cat.skills.length > 0)
    .slice(0, 12);

  const skillCategories =
    modelSkillCategories.length > 0
      ? modelSkillCategories
      : buildSkillCategoriesFromProjects(selectedProjects);

  const dedupedProjects = projects.filter((project) => {
    const title = project.title.toLowerCase();
    if (workTitles.has(title)) return false;
    const duplicateWork = workExperience.some((entry) =>
      entry.bullets.some(
        (bullet) => bullet.toLowerCase() === (project.description ?? '').toLowerCase()
      )
    );
    return !duplicateWork;
  });

  return generationOutputSchema.parse({
    summary,
    workExperience,
    projects: dedupedProjects,
    sections: ensuredSections,
    resumeBullets: resumeBullets.length > 0 ? resumeBullets : undefined,
    markdown,
    keywords,
    skillCategories: skillCategories.length > 0 ? skillCategories : undefined,
    sources: ensuredSources,
    rationale:
      output.rationale?.map((item) => item.trim()).filter(Boolean).slice(0, 20) || undefined,
  });
}

export function countGenerationBullets(content: GenerationOutput) {
  const workBullets = content.workExperience.reduce(
    (sum, entry) => sum + entry.bullets.length,
    0
  );
  const projectBullets = content.projects.reduce(
    (sum, entry) => sum + (entry.bullets?.length ?? 0),
    0
  );
  const sectionBullets = content.sections.reduce(
    (sum, section) => sum + section.bullets.length,
    0
  );
  return workBullets + projectBullets + sectionBullets;
}
