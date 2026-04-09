import crypto from 'crypto';

export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 5);
}

export function normalizeTechStack(techStack: string[]) {
  return Array.from(
    new Set(
      techStack
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

export function buildFingerprint(input: { title: string; description: string }) {
  return crypto
    .createHash('sha256')
    .update(`${input.title.trim().toLowerCase()}::${input.description.trim().toLowerCase()}`)
    .digest('hex');
}

export function isQualityEntity(entity: {
  title: string;
  description: string;
  techStack: string[];
}) {
  return (
    entity.title.trim().length >= 4 &&
    entity.description.trim().length >= 40 &&
    entity.techStack.length > 0
  );
}

export function contentToLines(content: unknown) {
  const lines: string[] = [];

  if (!content || typeof content !== 'object') {
    return ['No content available'];
  }

  const payload = content as {
    summary?: string;
    sections?: Array<{ title?: string; bullets?: string[] }>;
    resumeBullets?: string[];
    markdown?: string;
    keywords?: string[];
  };

  if (payload.summary) {
    lines.push('Summary');
    lines.push(payload.summary);
    lines.push('');
  }

  if (payload.sections?.length) {
    lines.push('Sections');
    for (const section of payload.sections) {
      lines.push(section.title ?? 'Untitled Section');
      for (const bullet of section.bullets ?? []) {
        lines.push(`- ${bullet}`);
      }
      lines.push('');
    }
  }

  if (payload.resumeBullets?.length) {
    lines.push('Resume Bullets');
    for (const bullet of payload.resumeBullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push('');
  }

  if (payload.markdown) {
    lines.push('Markdown');
    lines.push(payload.markdown);
    lines.push('');
  }

  if (payload.keywords?.length) {
    lines.push(`Keywords: ${payload.keywords.join(', ')}`);
  }

  return lines.length > 0 ? lines : ['No content available'];
}
