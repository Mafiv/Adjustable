import { describe, expect, it } from 'vitest';
import { buildSkillCategoriesFromProjects, normalizeGenerationOutput } from './cv-generation';
import { isRefusalOrMetaText, rawOutputLooksLikeRefusal } from './cv-generation-guards';

describe('cv-generation-guards', () => {
  it('detects refusal/meta text', () => {
    expect(isRefusalOrMetaText('No matched vault projects were found for this request.')).toBe(true);
    expect(isRefusalOrMetaText('Built a FastAPI service with Redis caching.')).toBe(false);
  });

  it('flags raw LLM refusal payloads', () => {
    expect(
      rawOutputLooksLikeRefusal({
        summary: 'No matching projects found in the vault.',
        workExperience: [{ company: 'Meta', bullets: ["Here's what data I'd need to continue"] }],
      })
    ).toBe(true);
  });
});

describe('cv-generation normalization', () => {
  const projects = [
    {
      _id: { toString: () => 'p1' },
      title: 'API Platform',
      description: 'Built a NestJS and FastAPI platform with PostgreSQL and Redis.',
      techStack: ['NestJS', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'],
      tags: ['backend'],
    },
    {
      _id: { toString: () => 'p2' },
      title: 'Automation Workflows',
      description: 'Implemented n8n automations with React dashboard.',
      techStack: ['n8n', 'React', 'Node.js'],
      tags: ['automation'],
    },
  ];

  it('builds skill categories from vault tech stacks', () => {
    const categories = buildSkillCategoriesFromProjects(projects);
    expect(categories.some((cat) => cat.category === 'Backend')).toBe(true);
    expect(categories.flatMap((cat) => cat.skills)).toContain('NestJS');
  });

  it('strips refusal text and avoids portfolio keyword placeholder', () => {
    const normalized = normalizeGenerationOutput(
      {
        summary: 'No matched vault projects were found for this request.',
        workExperience: [
          {
            company: 'Need more data',
            role: 'Placeholder',
            bullets: ["Here's what data I'd need"],
          },
        ],
        projects: [
          {
            title: "Here's what data I'd need",
            description: "Here's what data I'd need",
          },
        ],
        keywords: [],
      },
      projects
    );

    expect(isRefusalOrMetaText(normalized.summary)).toBe(false);
    expect(normalized.keywords).not.toEqual(['portfolio']);
    expect(normalized.keywords).toContain('NestJS');
    expect(normalized.skillCategories?.length).toBeGreaterThan(0);
    expect(normalized.sections.length).toBe(0);
  });
});
