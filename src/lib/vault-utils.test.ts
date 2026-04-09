import { describe, expect, it } from 'vitest';
import {
  buildFingerprint,
  contentToLines,
  isQualityEntity,
  normalizeTags,
  normalizeTechStack,
} from './vault-utils';

describe('vault-utils', () => {
  it('normalizes tags to lowercase, unique, max five', () => {
    const tags = normalizeTags([
      ' Next.js ',
      'MongoDB',
      'next.js',
      'RAG',
      'Vector Search',
      'AI',
      'extra',
    ]);

    expect(tags).toEqual(['next.js', 'mongodb', 'rag', 'vector search', 'ai']);
  });

  it('normalizes tech stack unique and capped', () => {
    const techStack = normalizeTechStack([' Next.js ', 'MongoDB', 'Next.js']);
    expect(techStack).toEqual(['Next.js', 'MongoDB']);
  });

  it('creates deterministic fingerprint', () => {
    const a = buildFingerprint({ title: 'A', description: 'B' });
    const b = buildFingerprint({ title: ' a ', description: ' b ' });
    expect(a).toBe(b);
  });

  it('applies minimum quality threshold', () => {
    expect(
      isQualityEntity({
        title: 'API Platform',
        description:
          'Built a role-aware API platform with analytics, auth and performance tuning.',
        techStack: ['Next.js'],
      })
    ).toBe(true);

    expect(
      isQualityEntity({
        title: 'API',
        description: 'Too short',
        techStack: [],
      })
    ).toBe(false);
  });

  it('serializes generated content into lines', () => {
    const lines = contentToLines({
      summary: 'Summary text',
      sections: [{ title: 'Experience', bullets: ['Did X'] }],
      keywords: ['next.js'],
    });

    expect(lines.join('\n')).toContain('Summary');
    expect(lines.join('\n')).toContain('Experience');
    expect(lines.join('\n')).toContain('- Did X');
  });
});
