import { normalizeTags, normalizeTechStack, isQualityEntity } from '@/lib/vault-utils';
import {
  normalizeEducationEntries,
  parseLanguagesFromText,
} from '@/lib/resume-profile';
import type { EducationEntry } from '@/types/profile';
import { z } from 'zod';

const atomicEntityLooseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  impactScore: z.number().min(1).max(10).optional(),
});

const atomicEntitySchema = z.object({
  title: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  tags: z.array(z.string()),
  impactScore: z.number().min(1).max(10),
});

export type AtomicEntityLoose = z.infer<typeof atomicEntityLooseSchema>;
export type AtomicEntity = z.infer<typeof atomicEntitySchema>;

export function scoreImpactFromText(text: string) {
  const lower = text.toLowerCase();
  if (/increased|reduced|improved|optimized|shipped|launched|saved/.test(lower)) {
    return 8;
  }
  if (/built|developed|implemented|created|designed/.test(lower)) {
    return 7;
  }
  return 6;
}

export function guessTechStackFromText(text: string) {
  const lower = text.toLowerCase();
  const dictionary = [
    'typescript',
    'javascript',
    'react',
    'next.js',
    'nextjs',
    'node.js',
    'node',
    'mongodb',
    'postgresql',
    'mysql',
    'redis',
    'python',
    'java',
    'docker',
    'kubernetes',
    'aws',
    'azure',
    'gcp',
    'graphql',
    'rest',
    'tailwind',
  ];

  const found = dictionary.filter((token) => lower.includes(token));
  return found.length > 0 ? found.slice(0, 8) : ['general'];
}

export function heuristicResumeEntities(resumeText: string, maxEntities: number): AtomicEntity[] {
  const chunks = resumeText
    .split(/\n{2,}|(?=\-\s)|(?=\u2022\s)/g)
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((chunk) => chunk.length >= 60)
    .slice(0, maxEntities * 2);

  const picked = (chunks.length > 0 ? chunks : [resumeText])
    .slice(0, maxEntities)
    .map((chunk, index) => {
      const titleSeed = chunk
        .replace(/^[\-\u2022\d\.\)\s]+/, '')
        .split(/[\.:]/)
        [0]
        .trim();
      const titleWords = titleSeed.split(/\s+/).slice(0, 8);
      const title = (titleWords.join(' ') || `Resume Entity ${index + 1}`).slice(0, 80);

      const techStack = normalizeTechStack(guessTechStackFromText(chunk));
      const tags = normalizeTags(techStack.slice(0, 5));

      return {
        title,
        description: chunk.slice(0, 600),
        techStack,
        tags,
        impactScore: scoreImpactFromText(chunk),
      };
    });

  return picked.filter(isQualityEntity);
}

export function normalizeAtomicEntity(
  entity: AtomicEntityLoose,
  index: number
): AtomicEntity {
  const fallbackText = `${entity.title ?? ''} ${entity.description ?? ''}`.trim();
  const description =
    entity.description?.trim() ||
    fallbackText ||
    `Resume entity extracted from chunk ${index + 1}.`;
  const title =
    entity.title?.trim() ||
    description
      .replace(/^[\-\u2022\d\.\)\s]+/, '')
      .split(/[\.:]/)
      [0]
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .join(' ') ||
    `Resume Entity ${index + 1}`;

  const derivedTech = guessTechStackFromText(`${title} ${description}`);
  const techStack = normalizeTechStack(
    Array.isArray(entity.techStack) && entity.techStack.length > 0
      ? entity.techStack
      : derivedTech
  );
  const tags = normalizeTags(
    Array.isArray(entity.tags) && entity.tags.length > 0
      ? entity.tags
      : techStack.slice(0, 5)
  );
  const impactScore = entity.impactScore ?? scoreImpactFromText(description);

  return {
    title: title.slice(0, 80),
    description: description.slice(0, 600),
    techStack,
    tags,
    impactScore,
  };
}

function extractSummaryHeuristic(resumeText: string) {
  const sectionMatch = resumeText.match(
    /(?:^|\n)\s*(?:summary|professional summary|profile|about(?:\s+me)?|bio)\s*[:\-]?\s*\n([\s\S]*?)(?=\n\s*(?:skills|education|work experience|experience|projects|languages|technical|certifications)\b|$)/im
  );
  if (sectionMatch?.[1]) {
    return sectionMatch[1].replace(/\s+/g, ' ').trim().slice(0, 1000);
  }

  const inlineMatch = resumeText.match(
    /(?:^|\n)\s*(?:summary|professional summary|profile|about(?:\s+me)?|bio)\s*[:\-]\s*([^\n]+)/im
  );
  return inlineMatch?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 1000) ?? '';
}

function extractLanguagesHeuristic(resumeText: string) {
  const sectionMatch = resumeText.match(
    /(?:^|\n)\s*languages?\s*[:\-]?\s*\n([\s\S]*?)(?=\n\s*(?:skills|education|work experience|experience|projects|summary|professional interests|interests|certifications)\b|$)/im
  );
  if (sectionMatch?.[1]) {
    const lines = sectionMatch[1]
      .split(/\n/)
      .map((line) => line.replace(/^[\-\u2022•]\s*/, '').trim())
      .filter((line) => line.length > 0 && line.length < 80);
    if (lines.length > 0) {
      return parseLanguagesFromText(lines.join(', '));
    }
  }

  const inlineMatch = resumeText.match(/(?:^|\n)\s*languages?\s*[:\-]\s*([^\n]+)/im);
  return inlineMatch?.[1] ? parseLanguagesFromText(inlineMatch[1]) : [];
}

const DATE_RANGE_RE =
  /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\b\d{4}\b|\bpresent\b|\bcurrent\b)/gi;

function extractDateRange(text: string) {
  const matches = [...text.matchAll(DATE_RANGE_RE)].map((match) => match[0].trim());
  if (matches.length >= 2) {
    return { startDate: matches[0], endDate: matches[matches.length - 1] };
  }
  if (matches.length === 1) {
    return { startDate: '', endDate: matches[0] };
  }
  return { startDate: '', endDate: '' };
}

function splitHonorsAndCoursework(text: string) {
  const honors: string[] = [];
  const coursework: string[] = [];

  for (const part of text.split(/[;|]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/coursework|relevant courses|courses taken/i.test(trimmed)) {
      coursework.push(trimmed.replace(/^coursework\s*[:\-]?\s*/i, '').trim());
    } else if (/gpa|honou?rs?|dean|cum laude|magna|summa|distinction/i.test(trimmed)) {
      honors.push(trimmed);
    } else if (/coursework/i.test(trimmed)) {
      coursework.push(trimmed);
    } else if (trimmed.length > 0) {
      honors.push(trimmed);
    }
  }

  return {
    honors: honors.join('; '),
    coursework: coursework.join('; '),
  };
}

function parseEducationBlock(block: string): EducationEntry | null {
  const lines = block
    .split(/\n/)
    .map((line) => line.replace(/^[\-\u2022•]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const joined = lines.join(' | ');
  const { startDate, endDate } = extractDateRange(joined);

  let degree = '';
  let institution = '';
  let location = '';
  let honors = '';
  let coursework = '';

  const degreePatterns = [
    /\b(b\.?s\.?c?\.?|b\.?a\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|b\.?e\.?|b\.?tech|m\.?tech|associate|diploma|certificate)\b[^|,\n]*/i,
    /\b(bachelor|master|doctorate|doctoral)\s+(?:of\s+)?[^|,\n]+/i,
  ];

  for (const line of lines) {
    if (!degree) {
      for (const pattern of degreePatterns) {
        const match = line.match(pattern);
        if (match) {
          degree = match[0].trim();
          break;
        }
      }
    }

    if (/university|college|institute|school|academy/i.test(line) && !institution) {
      institution = line.replace(DATE_RANGE_RE, '').replace(/\s*[,\|]\s*/g, ' ').trim();
    }

    if (/gpa|honou?rs?|coursework|dean/i.test(line)) {
      const split = splitHonorsAndCoursework(line);
      honors = [honors, split.honors].filter(Boolean).join('; ');
      coursework = [coursework, split.coursework].filter(Boolean).join('; ');
    }
  }

  if (!degree) {
    degree = lines[0].replace(DATE_RANGE_RE, '').trim();
  }
  if (!institution) {
    institution =
      lines.find((line) => /university|college|institute|school/i.test(line))?.replace(DATE_RANGE_RE, '').trim() ??
      lines[1]?.replace(DATE_RANGE_RE, '').trim() ??
      '';
  }

  const locationMatch = joined.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z][A-Za-z\s]+)\b/);
  if (locationMatch) {
    location = locationMatch[1].trim();
  }

  const entry = {
    degree,
    institution,
    startDate,
    endDate,
    location,
    honors,
    coursework,
  };

  if (!entry.degree && !entry.institution && !entry.startDate && !entry.endDate) {
    return null;
  }

  return entry;
}

function extractEducationHeuristic(resumeText: string): EducationEntry[] {
  const sectionMatch = resumeText.match(
    /(?:^|\n)\s*education\s*[:\-]?\s*\n([\s\S]*?)(?=\n\s*(?:skills|work experience|experience|projects|languages|summary|certifications|professional)\b|$)/im
  );
  if (!sectionMatch?.[1]) return [];

  const blocks = sectionMatch[1]
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 8);

  const lineBlocks =
    blocks.length > 1
      ? blocks
      : sectionMatch[1]
          .split(/\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 8)
          .reduce<string[]>((acc, line) => {
            if (/university|college|institute|school|b\.?s\.?c?|bachelor|master|ph\.?d/i.test(line) && acc.length > 0) {
              acc.push(line);
              return acc;
            }
            if (acc.length === 0 || /university|college|institute|school|b\.?s\.?c?|bachelor|master|ph\.?d/i.test(line)) {
              acc.push(line);
            } else {
              acc[acc.length - 1] = `${acc[acc.length - 1]}\n${line}`;
            }
            return acc;
          }, []);

  return normalizeEducationEntries(
    lineBlocks.map(parseEducationBlock).filter((entry): entry is EducationEntry => Boolean(entry))
  );
}

export function extractPersonalInfoHeuristics(resumeText: string) {
  const compact = resumeText.replace(/\s+/g, ' ').trim();

  const email = compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';

  const phoneCandidate =
    compact.match(/(?:\+?\d[\d\s()\-.]{7,}\d)/)?.[0]?.trim() ?? '';
  const phoneDigits = phoneCandidate.replace(/\D/g, '');
  const phone = phoneDigits.length >= 9 ? phoneCandidate : '';

  const linkedin =
    compact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9_\-\/.%]+/i)?.[0] ?? '';

  const github =
    compact.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_\-\/.%]+/i)?.[0] ?? '';

  const urlMatches =
    compact.match(
      /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9\-]+\.[A-Za-z]{2,}(?:\/[A-Za-z0-9_\-\/.%]*)?/g
    ) ?? [];
  const portfolio =
    urlMatches.find(
      (url) =>
        !/linkedin\.com/i.test(url) && !/github\.com/i.test(url) && !/@/.test(url)
    ) ?? '';

  const titlePattern =
    /(full[-\s]?stack(?:\s+developer|\s+engineer)?|software\s+engineer|software\s+developer|backend\s+developer|frontend\s+developer|data\s+engineer|devops\s+engineer|intern)/i;
  const title = compact.match(titlePattern)?.[0] ?? '';

  const beforeContact = compact
    .split(/(?:\s(?:email|e-mail|phone|linkedin|github)\s)|@|(?:\+?\d[\d\s()\-.]{7,}\d)/i)[0]
    ?.trim() ?? '';
  const nameTokens = beforeContact
    .replace(/[^A-Za-z\s''-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => /^[A-Z][A-Za-z''-]{1,}$/.test(token))
    .slice(0, 4);
  const name = nameTokens.length >= 2 ? nameTokens.join(' ') : '';

  return {
    name,
    title,
    email,
    phone,
    linkedin,
    github,
    portfolio,
    summary: extractSummaryHeuristic(resumeText),
    languages: extractLanguagesHeuristic(resumeText),
    education: extractEducationHeuristic(resumeText),
  };
}
