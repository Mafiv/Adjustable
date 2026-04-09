'use server';

import { embed } from 'ai';
import { embeddingModel } from '@/lib/models';
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { PortfolioFeedback, PortfolioGeneration, Project, UserProfile } from '@/lib/db/models';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Types } from 'mongoose';
import { requireSessionUser } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import {
  buildFingerprint,
  contentToLines,
  isQualityEntity,
  normalizeTags,
  normalizeTechStack,
} from '@/lib/vault-utils';
import { withTelemetry } from '@/lib/observability';

const addProjectSchema = z.object({
  rawInput: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

const shredResumeSchema = z.object({
  resumeText: z.string().min(40),
  maxEntities: z.number().int().min(1).max(30).default(12),
});

const generatePortfolioSchema = z.object({
  jobDescription: z.string().min(40),
  outputFormat: z.enum(['sections', 'resume', 'json', 'markdown']).default('sections'),
  topK: z.number().int().min(1).max(20).default(5),
  mustHaveSkills: z.array(z.string()).default([]),
  tone: z.string().optional(),
  audience: z.string().optional(),
  includeRationale: z.boolean().default(false),
});

const feedbackEventSchema = z.object({
  generationId: z.string().min(1),
  eventType: z.enum(['view', 'edit', 'export_pdf', 'apply', 'positive', 'negative']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const analyticsSchema = z.object({
  windowDays: z.number().int().min(1).max(365).default(30),
});

const exportPdfSchema = z.object({
  generationId: z.string().min(1),
});

const userProfileSchema = z.object({
  name:      z.string().max(120).default(''),
  title:     z.string().max(120).default(''),
  email:     z.string().max(200).default(''),
  phone:     z.string().max(60).default(''),
  location:  z.string().max(120).default(''),
  linkedin:  z.string().max(300).default(''),
  portfolio: z.string().max(300).default(''),
  summary:   z.string().max(1000).default(''),
  education: z.array(z.object({
    degree:      z.string().max(120).default(''),
    institution: z.string().max(120).default(''),
    year:        z.string().max(40).default(''),
  })).default([]),
});

const deleteProjectSchema = z.object({
  projectId: z.string().min(1),
});

const updateProjectSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  techStack: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  impactScore: z.number().int().min(1).max(10),
});

const generationOutputSchema = z.object({
  summary: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  resumeBullets: z.array(z.string()).optional(),
  markdown: z.string().optional(),
  keywords: z.array(z.string()),
  sources: z.array(
    z.object({
      projectId: z.string(),
      evidence: z.string(),
    })
  ),
  rationale: z.array(z.string()).optional(),
});

const generationOutputLooseSchema = z.object({
  summary: z.string().optional(),
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const atomicEntitySchema = z.object({
  title: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  tags: z.array(z.string()),
  impactScore: z.number().min(1).max(10),
});

const atomicEntityLooseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  impactScore: z.number().min(1).max(10).optional(),
});

// Schema for extracting personal info from resume text
const resumePersonalInfoSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  summary: z.string().optional(),
  education: z.array(z.object({
    degree: z.string().optional(),
    institution: z.string().optional(),
    year: z.string().optional(),
  })).optional(),
});

function firstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function hasAnyProfileValue(input: {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  education: Array<{ degree: string; institution: string; year: string }>;
}) {
  return (
    Boolean(input.name) ||
    Boolean(input.title) ||
    Boolean(input.email) ||
    Boolean(input.phone) ||
    Boolean(input.location) ||
    Boolean(input.linkedin) ||
    Boolean(input.portfolio) ||
    Boolean(input.summary) ||
    input.education.length > 0
  );
}

function extractPersonalInfoHeuristics(resumeText: string) {
  const compact = resumeText.replace(/\s+/g, ' ').trim();

  const email = compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';

  const phoneCandidate =
    compact.match(/(?:\+?\d[\d\s()\-.]{7,}\d)/)?.[0]?.trim() ?? '';
  const phoneDigits = phoneCandidate.replace(/\D/g, '');
  const phone = phoneDigits.length >= 9 ? phoneCandidate : '';

  const linkedin =
    compact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9_\-\/.%]+/i)?.[0] ?? '';

  const urlMatches = compact.match(/(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9\-]+\.[A-Za-z]{2,}(?:\/[A-Za-z0-9_\-\/.%]*)?/g) ?? [];
  const portfolio =
    urlMatches.find((url) => !/linkedin\.com/i.test(url) && !/@/.test(url)) ?? '';

  const titlePattern =
    /(full[-\s]?stack(?:\s+developer|\s+engineer)?|software\s+engineer|software\s+developer|backend\s+developer|frontend\s+developer|data\s+engineer|devops\s+engineer|intern)/i;
  const title = compact.match(titlePattern)?.[0] ?? '';

  const beforeContact = compact
    .split(/(?:\s(?:email|e-mail|phone|linkedin)\s)|@|(?:\+?\d[\d\s()\-.]{7,}\d)/i)[0]
    ?.trim() ?? '';
  const nameTokens = beforeContact
    .replace(/[^A-Za-z\s'’-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => /^[A-Z][A-Za-z'’-]{1,}$/.test(token))
    .slice(0, 4);
  const name = nameTokens.length >= 2 ? nameTokens.join(' ') : '';

  return {
    name,
    title,
    email,
    phone,
    linkedin,
    portfolio,
  };
}

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference';
const PRIMARY_CHAT_MODEL_ID = 'openai/gpt-4.1';
const SECONDARY_CHAT_MODEL_ID = 'openai/gpt-4.1-mini';
const NATIVE_CHAT_MODEL_IDS = [PRIMARY_CHAT_MODEL_ID, SECONDARY_CHAT_MODEL_ID];

const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_MODELS_TOKEN;

const inferenceClient = githubToken
  ? ModelClient(GITHUB_MODELS_ENDPOINT, new AzureKeyCredential(githubToken))
  : null;

function buildEmbeddingText(input: {
  title: string;
  description: string;
  techStack: string[];
}) {
  return [
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    `Tech: ${input.techStack.join(', ')}`,
  ].join('\n');
}

function isModelNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = `${error.name} ${error.message}`.toLowerCase();
  return text.includes('not found') || text.includes('404');
}

function getUnexpectedErrorMessage(response: { status: string; body?: unknown }) {
  const fallback = `GitHub inference request failed with status ${response.status}.`;

  if (!response.body || typeof response.body !== 'object') {
    return fallback;
  }

  const body = response.body as {
    error?: {
      code?: string;
      message?: string;
    };
    message?: string;
  };

  if (body.error?.message) {
    return body.error.code
      ? `${body.error.message} (${body.error.code})`
      : body.error.message;
  }

  if (body.message) {
    return body.message;
  }

  return fallback;
}

async function generateObjectWithNativeInference<TSchema extends z.ZodTypeAny>(params: {
  schema: TSchema;
  prompt: string;
}) {
  if (!inferenceClient) {
    throw new Error('Missing GitHub token. Set GITHUB_TOKEN or GITHUB_MODELS_TOKEN.');
  }

  let lastError: unknown;

  for (let index = 0; index < NATIVE_CHAT_MODEL_IDS.length; index += 1) {
    const modelId = NATIVE_CHAT_MODEL_IDS[index];

    try {
      const response = await inferenceClient.path('/chat/completions').post({
        body: {
          model: modelId,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You must return only valid JSON object output matching the requested schema. Do not include markdown fences.',
            },
            {
              role: 'user',
              content: params.prompt,
            },
          ],
        },
      });

      if (isUnexpected(response)) {
        const message = getUnexpectedErrorMessage(response);
        throw new Error(`Model ${modelId} failed (${response.status}): ${message}`);
      }

      const rawContent = response.body.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error(`Model ${modelId} returned empty content.`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new Error(`Model ${modelId} returned non-JSON content.`);
      }

      const object = params.schema.parse(parsed);
      return { object, modelId };
    } catch (error) {
      lastError = error;
      const shouldRetry =
        index < NATIVE_CHAT_MODEL_IDS.length - 1 && isModelNotFoundError(error);

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error(
    `No configured chat models are available. Tried: ${NATIVE_CHAT_MODEL_IDS.join(', ')}`,
    { cause: lastError }
  );
}

function scoreImpactFromText(text: string) {
  const lower = text.toLowerCase();
  if (/increased|reduced|improved|optimized|shipped|launched|saved/.test(lower)) {
    return 8;
  }
  if (/built|developed|implemented|created|designed/.test(lower)) {
    return 7;
  }
  return 6;
}

function guessTechStackFromText(text: string) {
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

function heuristicResumeEntities(resumeText: string, maxEntities: number) {
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
        .split(/[\.:]/)[0]
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

function normalizeAtomicEntity(
  entity: z.infer<typeof atomicEntityLooseSchema>,
  index: number
): z.infer<typeof atomicEntitySchema> {
  const fallbackText = `${entity.title ?? ''} ${entity.description ?? ''}`.trim();
  const description =
    entity.description?.trim() || fallbackText || `Resume entity extracted from chunk ${index + 1}.`;
  const title =
    entity.title?.trim() ||
    description
      .replace(/^[\-\u2022\d\.\)\s]+/, '')
      .split(/[\.:]/)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .join(' ') ||
    `Resume Entity ${index + 1}`;

  const derivedTech = guessTechStackFromText(`${title} ${description}`);
  const techStack = normalizeTechStack(
    Array.isArray(entity.techStack) && entity.techStack.length > 0 ? entity.techStack : derivedTech
  );
  const tags = normalizeTags(
    Array.isArray(entity.tags) && entity.tags.length > 0 ? entity.tags : techStack.slice(0, 5)
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

function normalizeGenerationOutput(
  output: z.infer<typeof generationOutputLooseSchema>,
  selectedProjects: Array<{
    _id: { toString: () => string };
    title: string;
    description: string;
    techStack?: string[];
    tags?: string[];
  }>
): z.infer<typeof generationOutputSchema> {
  const firstProject = selectedProjects[0];

  const sections = (output.sections ?? [])
    .slice(0, 8)
    .map((section, index) => {
      const title =
        section.title?.trim() ||
        selectedProjects[index]?.title ||
        `Section ${index + 1}`;
      const bullets = (section.bullets ?? [])
        .map((bullet) => bullet.trim())
        .filter(Boolean)
        .slice(0, 8);

      const fallbackBullet =
        selectedProjects[index]?.description?.slice(0, 180) ||
        firstProject?.description?.slice(0, 180) ||
        `Demonstrated outcomes relevant to ${title.toLowerCase()}.`;

      return {
        title,
        bullets: bullets.length > 0 ? bullets : [fallbackBullet],
      };
    });

  const ensuredSections =
    sections.length > 0
      ? sections
      : selectedProjects.slice(0, 3).map((project) => ({
          title: project.title,
          bullets: [project.description.slice(0, 180)],
        }));

  const keywordPool = selectedProjects.flatMap((project) => [
    ...(project.techStack ?? []),
    ...(project.tags ?? []),
  ]);
  const keywords = (output.keywords ?? keywordPool)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 20);

  const sources = (output.sources ?? [])
    .map((source, index) => ({
      projectId:
        source.projectId?.trim() || selectedProjects[index]?._id.toString() || firstProject?._id.toString() || 'unknown',
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
      : selectedProjects.slice(0, 5).map((project) => ({
          projectId: project._id.toString(),
          evidence: project.description.slice(0, 220),
        }));

  const summary =
    output.summary?.trim() ||
    ensuredSections[0]?.bullets[0] ||
    firstProject?.description?.slice(0, 200) ||
    'Generated portfolio summary.';

  const resumeBullets =
    (output.resumeBullets ?? [])
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, 20);

  const markdown =
    output.markdown?.trim() ||
    [
      `# Portfolio Summary`,
      summary,
      ...ensuredSections.map((section) =>
        [`## ${section.title}`, ...section.bullets.map((bullet) => `- ${bullet}`)].join('\n')
      ),
    ].join('\n\n');

  return generationOutputSchema.parse({
    summary,
    sections: ensuredSections,
    resumeBullets: resumeBullets.length > 0 ? resumeBullets : undefined,
    markdown,
    keywords: keywords.length > 0 ? keywords : ['portfolio'],
    sources: ensuredSources,
    rationale:
      output.rationale?.map((item) => item.trim()).filter(Boolean).slice(0, 20) || undefined,
  });
}

export async function addProjectToVault(input: unknown) {
  return withTelemetry('vault.addProjectToVault', {}, async () => {
    const user = await requireSessionUser();
    const { rawInput, tags } = addProjectSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    const { object } = await generateObjectWithNativeInference({
      schema: atomicEntityLooseSchema,
      prompt: [
        'Analyze this project text and extract structured data.',
        'Include fields: title, description, techStack (array), tags (array), impactScore (1-10).',
        `Project text:\n${rawInput}`,
      ].join('\n'),
    });

    const normalizedObject = normalizeAtomicEntity(
      {
        ...object,
        description: object.description ?? rawInput,
      },
      0
    );

    const normalizedTags = normalizeTags(tags ?? normalizedObject.tags);
    const normalizedTechStack = normalizeTechStack(normalizedObject.techStack);
    const fingerprint = buildFingerprint({
      title: normalizedObject.title,
      description: normalizedObject.description,
    });

    const existing = await Project.findOne({ userId, fingerprint }).lean();
    if (existing) {
      return {
        id: existing._id.toString(),
        title: existing.title,
        description: existing.description,
        techStack: existing.techStack,
        tags: existing.tags,
        impactScore: existing.impactScore,
        duplicate: true,
      };
    }

    const { embedding } = await embed({
      model: embeddingModel,
      value: buildEmbeddingText(normalizedObject),
    });

    const project = await Project.create({
      userId,
      title: normalizedObject.title,
      description: normalizedObject.description,
      fingerprint,
      techStack: normalizedTechStack,
      impactScore: normalizedObject.impactScore,
      tags: normalizedTags,
      embedding,
    });

    revalidatePath('/vault');

    return {
      id: project._id.toString(),
      ...normalizedObject,
      techStack: normalizedTechStack,
      tags: normalizedTags,
      duplicate: false,
    };
  });
}

export async function deleteProjectFromVault(input: unknown) {
  return withTelemetry('vault.deleteProjectFromVault', {}, async () => {
    const user = await requireSessionUser();
    const { projectId } = deleteProjectSchema.parse(input);

    await connectToDatabase();

    if (!Types.ObjectId.isValid(projectId)) {
      throw new Error('Invalid projectId');
    }

    const deleted = await Project.findOneAndDelete({
      _id: projectId,
      userId: user.id,
    }).lean();

    if (!deleted) {
      throw new Error('Project not found');
    }

    revalidatePath('/vault');
    return { ok: true, deletedId: projectId };
  });
}

export async function updateProjectInVault(input: unknown) {
  return withTelemetry('vault.updateProjectInVault', {}, async () => {
    const user = await requireSessionUser();
    const parsed = updateProjectSchema.parse(input);

    await connectToDatabase();

    if (!Types.ObjectId.isValid(parsed.projectId)) {
      throw new Error('Invalid projectId');
    }

    const existing = await Project.findOne({
      _id: parsed.projectId,
      userId: user.id,
    }).lean();

    if (!existing) {
      throw new Error('Project not found');
    }

    const title = parsed.title.trim();
    const description = parsed.description.trim();
    const techStack = normalizeTechStack(parsed.techStack);
    const tags = normalizeTags(parsed.tags);
    const impactScore = parsed.impactScore;
    const fingerprint = buildFingerprint({ title, description });

    const { embedding } = await embed({
      model: embeddingModel,
      value: buildEmbeddingText({ title, description, techStack }),
    });

    await Project.updateOne(
      { _id: parsed.projectId, userId: user.id },
      {
        $set: {
          title,
          description,
          techStack,
          tags,
          impactScore,
          fingerprint,
          embedding,
        },
      }
    );

    revalidatePath('/vault');

    return {
      id: parsed.projectId,
      title,
      description,
      techStack,
      tags,
      impactScore,
    };
  });
}

export async function shredResumeToVault(input: unknown) {
  return withTelemetry('vault.shredResumeToVault', {}, async () => {
    const user = await requireSessionUser();
    const { resumeText, maxEntities } = shredResumeSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    let entities: Array<z.infer<typeof atomicEntitySchema>> = [];
    let extractionMode: 'llm' | 'heuristic' = 'llm';

    try {
      const { object } = await generateObjectWithNativeInference({
        schema: z.object({
          entities: z.array(atomicEntityLooseSchema),
        }),
        prompt: [
          'Decompose this resume into atomic project/achievement entities.',
          'Each entity must stand on its own and be useful for retrieval.',
          'For each entity include: title, description, techStack (array), tags (array), impactScore (1-10).',
          `Return at most ${maxEntities} entities.`,
          'Avoid duplicates. Use concise, evidence-based descriptions.',
          `Resume:\n${resumeText}`,
        ].join('\n'),
      });

      entities = object.entities
        .slice(0, maxEntities)
        .map((entity, index) => normalizeAtomicEntity(entity, index));
    } catch (error) {
      if (!isModelNotFoundError(error)) {
        throw error;
      }

      extractionMode = 'heuristic';
      entities = heuristicResumeEntities(resumeText, maxEntities);
    }

    const qualityEntities = entities.filter(isQualityEntity);
    const seenFingerprints = new Set<string>();
    const uniqueEntities = qualityEntities.filter((entity) => {
      const fingerprint = buildFingerprint({
        title: entity.title,
        description: entity.description,
      });
      if (seenFingerprints.has(fingerprint)) {
        return false;
      }
      seenFingerprints.add(fingerprint);
      return true;
    });

    const fingerprints = uniqueEntities.map((entity) =>
      buildFingerprint({ title: entity.title, description: entity.description })
    );

    const existing =
      fingerprints.length > 0
        ? await Project.find({ userId, fingerprint: { $in: fingerprints } }, { fingerprint: 1 }).lean()
        : [];
    const existingSet = new Set(existing.map((item) => item.fingerprint));
    const insertableEntities = uniqueEntities.filter(
      (entity) =>
        !existingSet.has(
          buildFingerprint({ title: entity.title, description: entity.description })
        )
    );

    const docs = await Promise.all(
      insertableEntities.map(async (entity) => {
        const fingerprint = buildFingerprint({
          title: entity.title,
          description: entity.description,
        });
        const { embedding } = await embed({
          model: embeddingModel,
          value: buildEmbeddingText({
            title: entity.title,
            description: entity.description,
            techStack: entity.techStack,
          }),
        });

        return {
          userId,
          title: entity.title,
          description: entity.description,
          fingerprint,
          techStack: entity.techStack,
          impactScore: entity.impactScore,
          tags: entity.tags,
          embedding,
        };
      })
    );

    const inserted = docs.length > 0 ? await Project.insertMany(docs) : [];

    // Extract personal info from resume and update UserProfile
    let personalInfo: z.infer<typeof resumePersonalInfoSchema> | null = null;
    let profileAutoUpdated = false;
    try {
      const { object } = await generateObjectWithNativeInference({
        schema: resumePersonalInfoSchema,
        prompt: [
          'Extract personal information from this resume text.',
          'Infer the candidate name from the resume header even if the label "full name" is not explicitly written.',
          'Prioritize contact/header details: name, title, email, phone, location, linkedin, portfolio.',
          'Return only the information that is explicitly present in the resume.',
          'For education, extract all degrees with their institutions and years.',
          'For links (linkedin, portfolio), return only the URL or username.',
          `Resume:\n${resumeText.slice(0, 15000)}`,
        ].join('\n'),
      });
      personalInfo = object;

      const heuristics = extractPersonalInfoHeuristics(resumeText);
      const existingProfile = await UserProfile.findOne({ userId }).lean();

      const mergedEducation =
        Array.isArray(existingProfile?.education) && existingProfile.education.length > 0
          ? existingProfile.education.map((edu) => ({
              degree: firstNonEmpty((edu as { degree?: string }).degree),
              institution: firstNonEmpty((edu as { institution?: string }).institution),
              year: firstNonEmpty((edu as { year?: string }).year),
            }))
          : (personalInfo.education ?? [])
              .map((edu) => ({
                degree: firstNonEmpty(edu.degree),
                institution: firstNonEmpty(edu.institution),
                year: firstNonEmpty(edu.year),
              }))
              .filter((edu) => edu.degree || edu.institution || edu.year);

      const mergedProfile = {
        name: firstNonEmpty(
          existingProfile?.name as string | undefined,
          personalInfo.name,
          heuristics.name
        ),
        title: firstNonEmpty(
          existingProfile?.title as string | undefined,
          personalInfo.title,
          heuristics.title
        ),
        email: firstNonEmpty(
          existingProfile?.email as string | undefined,
          personalInfo.email,
          heuristics.email
        ),
        phone: firstNonEmpty(
          existingProfile?.phone as string | undefined,
          personalInfo.phone,
          heuristics.phone
        ),
        location: firstNonEmpty(
          existingProfile?.location as string | undefined,
          personalInfo.location
        ),
        linkedin: firstNonEmpty(
          existingProfile?.linkedin as string | undefined,
          personalInfo.linkedin,
          heuristics.linkedin
        ),
        portfolio: firstNonEmpty(
          existingProfile?.portfolio as string | undefined,
          personalInfo.portfolio,
          heuristics.portfolio
        ),
        summary: firstNonEmpty(
          existingProfile?.summary as string | undefined,
          personalInfo.summary
        ),
        education: mergedEducation,
      };

      // Save to UserProfile (upsert) using safe merge; never overwrite known values with empty strings.
      if (hasAnyProfileValue(mergedProfile)) {
        await UserProfile.findOneAndUpdate(
          { userId },
          {
            $set: mergedProfile,
          },
          { upsert: true, new: true }
        );
        profileAutoUpdated = true;
      }
    } catch {
      // Personal info extraction is best-effort; don't fail the whole operation

      // Fallback heuristic-only update if LLM extraction fails.
      try {
        const existingProfile = await UserProfile.findOne({ userId }).lean();
        const heuristics = extractPersonalInfoHeuristics(resumeText);

        const mergedProfile = {
          name: firstNonEmpty(existingProfile?.name as string | undefined, heuristics.name),
          title: firstNonEmpty(existingProfile?.title as string | undefined, heuristics.title),
          email: firstNonEmpty(existingProfile?.email as string | undefined, heuristics.email),
          phone: firstNonEmpty(existingProfile?.phone as string | undefined, heuristics.phone),
          location: firstNonEmpty(existingProfile?.location as string | undefined),
          linkedin: firstNonEmpty(existingProfile?.linkedin as string | undefined, heuristics.linkedin),
          portfolio: firstNonEmpty(existingProfile?.portfolio as string | undefined, heuristics.portfolio),
          summary: firstNonEmpty(existingProfile?.summary as string | undefined),
          education:
            (existingProfile?.education as Array<{ degree?: string; institution?: string; year?: string }> | undefined)
              ?.map((edu) => ({
                degree: firstNonEmpty(edu.degree),
                institution: firstNonEmpty(edu.institution),
                year: firstNonEmpty(edu.year),
              }))
              .filter((edu) => edu.degree || edu.institution || edu.year) ?? [],
        };

        if (hasAnyProfileValue(mergedProfile)) {
          await UserProfile.findOneAndUpdate(
            { userId },
            { $set: mergedProfile },
            { upsert: true, new: true }
          );
          profileAutoUpdated = true;
        }
      } catch {
        // Best effort only.
      }
    }

    return {
      extractionMode,
      extractedCount: entities.length,
      qualityAcceptedCount: qualityEntities.length,
      duplicateSkippedCount: uniqueEntities.length - insertableEntities.length,
      insertedCount: inserted.length,
      entities: inserted.map((doc) => ({
        id: doc._id.toString(),
        title: doc.title,
        techStack: doc.techStack,
        tags: doc.tags,
        impactScore: doc.impactScore,
      })),
      personalInfoExtracted: personalInfo ? true : false,
      profileAutoUpdated,
    };
  });
}

export async function generatePortfolioFromJob(input: unknown) {
  return withTelemetry('vault.generatePortfolioFromJob', {}, async () => {
    const user = await requireSessionUser();
    const {
      jobDescription,
      outputFormat,
      topK,
      mustHaveSkills,
      tone,
      audience,
      includeRationale,
    } = generatePortfolioSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    const { embedding } = await embed({
      model: embeddingModel,
      value: jobDescription,
    });

    const vectorIndex =
      process.env.MONGODB_VECTOR_INDEX ?? 'adjustable-vectors';
    const numCandidates = Math.max(topK * 10, 50);

    const candidates = await Project.aggregate([
    {
      $vectorSearch: {
        index: vectorIndex,
        path: 'embedding',
        queryVector: embedding,
        numCandidates,
        limit: topK,
        filter: { userId },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        techStack: 1,
        impactScore: 1,
        tags: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);

    const filtered = mustHaveSkills.length
      ? candidates.filter((project) =>
          mustHaveSkills.every((skill) =>
            (project.techStack ?? []).includes(skill)
          )
        )
      : candidates;

    const selectedProjects = filtered.length > 0 ? filtered : candidates;

    const promptPayload = {
    jobDescription,
    outputFormat,
    tone,
    audience,
    mustHaveSkills,
    projects: selectedProjects.map((project) => ({
      id: project._id.toString(),
      title: project.title,
      description: project.description,
      techStack: project.techStack,
      impactScore: project.impactScore,
      tags: project.tags,
    })),
  };

    const prompt = [
      'You are an expert resume designer and ATS optimization specialist.',
      'Your task is to generate a job-specific, ATS-optimized CV draft based on the user project vault.',
      '### CORE RULES:',
      '- Only include relevant information that matches the job description.',
      '- Do NOT invent skills or experience. Stay grounded in the user payload.',
      '- Use strong action verbs (Built, Designed, Optimized, Led).',
      '- Quantify achievements whenever possible (e.g., Improved performance by 30%).',
      '- Focus on impact and results, not just responsibilities.',
      '- Keep bullet points concise and high-impact.',
      '',
      `### JOB DESCRIPTION:\n${jobDescription}`,
      '',
      '### OBJECTIVES:',
      '1. SUMMARY: A 2-4 line professional profile tailored to this role.',
      '2. SECTIONS: Group matched projects into logical experience blocks. Each block should have a job/project title and high-impact bullet points.',
      '3. KEYWORDS: Extract and include matching technical skills and tools from the JD.',
      '',
      `### FORMAT: ${outputFormat}`,
      includeRationale ? '- Include rationale statements in the rationale array explaining why certain projects were selected.' : '',
      'Return a JSON object matching the requested schema.',
      `### USER DATA PAYLOAD:\n${JSON.stringify(promptPayload)}`,
    ].join('\n');

    const { object } = await generateObjectWithNativeInference({
      schema: generationOutputLooseSchema,
      prompt,
    });

    const normalizedOutput = normalizeGenerationOutput(object, selectedProjects);

    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

    const generation = await PortfolioGeneration.create({
    userId,
    jobDescription,
    outputFormat,
    projectIds: selectedProjects.map((project) => project._id),
    content: normalizedOutput,
    promptHash,
    model: PRIMARY_CHAT_MODEL_ID,
    vectorIndex,
    topK,
    mustHaveSkills,
  });

    return {
      generationId: generation._id.toString(),
      format: outputFormat,
      content: normalizedOutput,
    };
  });
}

export async function exportPortfolioPdf(input: unknown) {
  return withTelemetry('vault.exportPortfolioPdf', {}, async () => {
    const user = await requireSessionUser();
    const { generationId } = exportPdfSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    if (!Types.ObjectId.isValid(generationId)) {
      throw new Error('Invalid generationId');
    }

    const generation = await PortfolioGeneration.findOne({
      _id: generationId,
      userId,
    }).lean();

    if (!generation) {
      throw new Error('Generation not found');
    }

    const content = generation.content as {
      summary?: string;
      sections?: Array<{ title?: string; bullets?: string[] }>;
      resumeBullets?: string[];
      keywords?: string[];
    };

    // Load personal profile (may be null if user hasn't filled it in yet)
    const profileDoc = await UserProfile.findOne({ userId }).lean();
    const profile = {
      name:      (profileDoc?.name      as string | undefined) ?? '',
      title:     (profileDoc?.title     as string | undefined) ?? '',
      email:     (profileDoc?.email     as string | undefined) ?? '',
      phone:     (profileDoc?.phone     as string | undefined) ?? '',
      location:  (profileDoc?.location  as string | undefined) ?? '',
      linkedin:  (profileDoc?.linkedin  as string | undefined) ?? '',
      portfolio: (profileDoc?.portfolio as string | undefined) ?? '',
      summary:   (profileDoc?.summary   as string | undefined) ?? '',
      education: (profileDoc?.education as Array<{ degree: string; institution: string; year: string }> | undefined) ?? [],
    };

    // ── Layout constants (A4 in points) ──────────────────────────────────
    const PAGE_W = 595;
    const PAGE_H = 842;
    const ML = 52;               // margin left
    const MR = 52;               // margin right
    const MT = 54;               // margin top (first page)
    const MB = 48;               // margin bottom (footer area)
    const CW = PAGE_W - ML - MR; // content width

    // ── Colors ───────────────────────────────────────────────────────────
    const cDark   = rgb(0.11, 0.09, 0.09); // #1C1717
    const cMid    = rgb(0.47, 0.44, 0.42); // #786F6B
    const cAccent = rgb(0.40, 0.22, 0.06); // #663810
    const cRule   = rgb(0.87, 0.85, 0.84); // #DED9D6

    // ── Font setup ───────────────────────────────────────────────────────
    const pdf       = await PDFDocument.create();
    const fReg      = await pdf.embedFont(StandardFonts.Helvetica);
    const fBold     = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page    = pdf.addPage([PAGE_W, PAGE_H]);
    let cursorY = PAGE_H - MT;

    const S = {
      name: 22,
      title: 12,
      meta: 9.25,
      section: 10,
      subhead: 11,
      body: 10,
      small: 8,
    };

    // ── Helpers ──────────────────────────────────────────────────────────

    /** Word-wrap text to fit within maxWidth, returning display lines. */
    function wrapText(text: string, font: typeof fReg, size: number, maxWidth: number): string[] {
      const words = text.replace(/\s+/g, ' ').trim().split(' ');
      const out: string[] = [];
      let cur = '';
      for (const word of words) {
        const trial = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
          out.push(cur);
          cur = word;
        } else {
          cur = trial;
        }
      }
      if (cur) out.push(cur);
      return out.length > 0 ? out : [''];
    }

    /** Ensure at least `needed` pts remain; otherwise add a new page. */
    function ensureRoom(needed: number) {
      if (cursorY - needed < MB) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        cursorY = PAGE_H - MT;
      }
    }

    /** Draw word-wrapped text block, advancing cursorY. */
    function drawBlock(
      text: string,
      font: typeof fReg,
      size: number,
      color: ReturnType<typeof rgb>,
      x: number,
      maxWidth: number,
      lineGap = 4
    ) {
      const lines = wrapText(text, font, size, maxWidth);
      for (const line of lines) {
        ensureRoom(size + lineGap);
        page.drawText(line, { x, y: cursorY, size, font, color });
        cursorY -= size + lineGap;
      }
    }

    function fitText(text: string, font: typeof fReg, size: number, maxWidth: number) {
      const input = text.replace(/\s+/g, ' ').trim();
      if (!input) return '';
      if (font.widthOfTextAtSize(input, size) <= maxWidth) return input;

      const ellipsis = '…';
      let out = input;
      while (out.length > 1 && font.widthOfTextAtSize(`${out}${ellipsis}`, size) > maxWidth) {
        out = out.slice(0, -1);
      }
      return `${out}${ellipsis}`;
    }

    function drawSingleLine(text: string, opts: { font: typeof fReg; size: number; color: ReturnType<typeof rgb>; x: number; maxWidth: number; gapBelow: number }) {
      const t = fitText(text, opts.font, opts.size, opts.maxWidth);
      if (!t) return;
      ensureRoom(opts.size + opts.gapBelow + 2);
      page.drawText(t, { x: opts.x, y: cursorY, size: opts.size, font: opts.font, color: opts.color });
      cursorY -= opts.size + opts.gapBelow;
    }

    /** Draw a full-width horizontal rule. */
    function drawRule(thickness = 0.6, color = cRule) {
      page.drawLine({
        start: { x: ML, y: cursorY },
        end:   { x: PAGE_W - MR, y: cursorY },
        thickness,
        color,
      });
    }

    /** Draw a section header label + rule, then advance cursorY. */
    function drawSectionHeader(label: string) {
      ensureRoom(34);
      cursorY -= 12; // breathing room above section
      page.drawText(label.toUpperCase(), {
        x: ML, y: cursorY,
        size: S.section, font: fBold, color: cDark,
      });
      cursorY -= 8;
      drawRule(0.6, cRule);
      cursorY -= 10;
    }

    function drawLeftRightLine(opts: {
      left: string;
      right?: string;
      sizeLeft?: number;
      sizeRight?: number;
      fontLeft?: typeof fReg;
      fontRight?: typeof fReg;
      colorLeft?: ReturnType<typeof rgb>;
      colorRight?: ReturnType<typeof rgb>;
      gapBelow?: number;
    }) {
      const {
        left,
        right,
        sizeLeft = S.subhead,
        sizeRight = S.meta,
        fontLeft = fBold,
        fontRight = fReg,
        colorLeft = cDark,
        colorRight = cMid,
        gapBelow = 6,
      } = opts;

      const l = left.trim();
      const r = (right ?? '').trim();
      if (!l && !r) return;

      ensureRoom(sizeLeft + gapBelow + 2);

      // Keep the left side from colliding with the right side.
      const rightW = r ? fontRight.widthOfTextAtSize(r, sizeRight) : 0;
      const leftMax = Math.max(0, CW - (r ? (rightW + 10) : 0));
      const leftLine = wrapText(l, fontLeft, sizeLeft, leftMax)[0] ?? '';

      page.drawText(leftLine, { x: ML, y: cursorY, size: sizeLeft, font: fontLeft, color: colorLeft });
      if (r) {
        page.drawText(r, {
          x: PAGE_W - MR - rightW,
          y: cursorY,
          size: sizeRight,
          font: fontRight,
          color: colorRight,
        });
      }

      cursorY -= sizeLeft + gapBelow;
    }

    /** Draw bullet point (dot + wrapped text). */
    function drawBullet(text: string) {
      const bulletIndent = 14;
      const textX = ML + bulletIndent;
      const lines = wrapText(text, fReg, S.body, CW - bulletIndent);
      ensureRoom(14);
      page.drawText('•', { x: ML + 2, y: cursorY, size: S.body, font: fBold, color: cDark });
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensureRoom(14);
        page.drawText(lines[i], { x: textX, y: cursorY, size: S.body, font: fReg, color: cDark });
        if (i < lines.length - 1) cursorY -= 13;
      }
      cursorY -= 14;
    }

    // ── SECTION 1 — Header ───────────────────────────────────────────────

    // Accent top bar (5pt tall)
    page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: cAccent });

    // Full name (or fallback title)
    const displayName = profile.name.trim() || 'Portfolio Resume';
    page.drawText(displayName, {
      x: ML, y: cursorY,
      size: S.name, font: fBold, color: cDark,
    });
    cursorY -= 24;

    // Job title line
    if (profile.title.trim()) {
      page.drawText(profile.title.trim(), {
        x: ML, y: cursorY,
        size: S.title, font: fReg, color: cAccent,
      });
      cursorY -= 15;
    }

    // Socials line — email · LinkedIn · portfolio/GitHub · phone
    const socialsParts: string[] = [];
    if (profile.email.trim()) socialsParts.push(profile.email.trim());
    if (profile.linkedin.trim()) socialsParts.push(profile.linkedin.trim());
    if (profile.portfolio.trim()) socialsParts.push(profile.portfolio.trim());
    if (profile.phone.trim()) socialsParts.push(profile.phone.trim());
    if (socialsParts.length > 0) {
      drawSingleLine(socialsParts.join('  ·  '), {
        font: fReg,
        size: S.meta,
        color: cMid,
        x: ML,
        maxWidth: CW,
        gapBelow: 6,
      });
      cursorY -= 2;
    }

    // Header divider
    cursorY -= 4;
    drawRule(0.8, cRule);
    cursorY -= 16;

    // ── SECTION 2 — Summary ──────────────────────────────────────────────
    // Prefer AI-generated summary; fall back to profile bio; skip generic fallbacks
    const summaryText = (() => {
      const gen = (content.summary ?? '').trim();
      if (gen && gen !== 'Generated portfolio summary.') return gen;
      return profile.summary.trim();
    })();
    if (summaryText) {
      drawSectionHeader('Summary');
      drawBlock(summaryText, fReg, S.body, cDark, ML, CW, 4);
      cursorY -= 1;
    }

    // ── SECTION 3 — Skills & Keywords ────────────────────────────────────
    if (content.keywords && content.keywords.length > 0) {
      drawSectionHeader('Technical Skills');
      const skillsLine = content.keywords
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 28)
        .join('  •  ');
      drawBlock(skillsLine, fReg, S.body, cDark, ML, CW, 4);
      cursorY -= 1;
    }

    const contentAny = content as unknown as Record<string, unknown>;
    const experienceAny = (contentAny.experience ?? contentAny.workExperience) as unknown;
    const projectsAny = contentAny.projects as unknown;

    const experienceEntries = Array.isArray(experienceAny) ? experienceAny : [];
    const projectEntries = Array.isArray(projectsAny) ? projectsAny : [];

    // ── SECTION 4 — Work Experience ──────────────────────────────────────
    if (experienceEntries.length > 0) {
      drawSectionHeader('Work Experience');
      for (const entry of experienceEntries.slice(0, 10)) {
        const e = entry as Record<string, unknown>;
        const role = String((e.role ?? e.title ?? '') as string).trim();
        const company = String((e.company ?? e.organization ?? e.employer ?? '') as string).trim();
        const duration = String((e.duration ?? e.dates ?? e.timeframe ?? '') as string).trim();
        const left = [role, company].filter(Boolean).join(' — ');

        const bulletsRaw = (e.bullets ?? e.highlights ?? e.achievements) as unknown;
        const bullets = Array.isArray(bulletsRaw)
          ? bulletsRaw.map((b) => String(b).trim()).filter(Boolean)
          : [];

        if (!left && bullets.length === 0) continue;

        drawLeftRightLine({ left: left || 'Role', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 4 });
        for (const bullet of bullets.slice(0, 5)) {
          drawBullet(bullet);
        }
        cursorY -= 2;
      }
    }

    // ── SECTION 5 — Projects ─────────────────────────────────────────────
    const shouldRenderProjectsFromStructured = projectEntries.length > 0;
    if (shouldRenderProjectsFromStructured) {
      drawSectionHeader('Projects');
      for (const entry of projectEntries.slice(0, 12)) {
        const p = entry as Record<string, unknown>;
        const name = String((p.name ?? p.title ?? '') as string).trim();
        const duration = String((p.duration ?? p.dates ?? p.timeframe ?? '') as string).trim();
        const techRaw = (p.techStack ?? p.tech ?? p.stack) as unknown;
        const tech = Array.isArray(techRaw) ? techRaw.map((t) => String(t).trim()).filter(Boolean) : [];
        const bulletsRaw = (p.bullets ?? p.highlights ?? p.achievements ?? p.descriptionBullets) as unknown;
        const bullets = Array.isArray(bulletsRaw)
          ? bulletsRaw.map((b) => String(b).trim()).filter(Boolean)
          : [];

        if (!name && bullets.length === 0) continue;

        drawLeftRightLine({ left: name || 'Project', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 4 });
        if (tech.length > 0) {
          const techLine = tech.slice(0, 18).join('  •  ');
          drawBlock(techLine, fReg, S.meta, cMid, ML, CW, 3);
          cursorY -= 2;
        }
        for (const bullet of bullets.slice(0, 3)) {
          drawBullet(bullet);
        }
        cursorY -= 2;
      }
    }

    // Fallback to existing generation sections if no structured projects were provided.
    if (!shouldRenderProjectsFromStructured && content.sections && content.sections.length > 0) {
      drawSectionHeader('Projects');
      for (const section of content.sections) {
        const raw = section as unknown as {
          title?: string;
          bullets?: string[];
          duration?: string;
          dates?: string;
          timeframe?: string;
          company?: string;
          role?: string;
          techStack?: string[];
          tech?: string[];
        };

        const name = (raw.title ?? '').trim();
        const duration = (raw.duration ?? raw.dates ?? raw.timeframe ?? '').trim();
        const tech = Array.isArray(raw.techStack)
          ? raw.techStack
          : Array.isArray(raw.tech)
            ? raw.tech
            : [];
        const bullets = (raw.bullets ?? []).map((b) => b.trim()).filter(Boolean);

        if (!name && bullets.length === 0) continue;

        drawLeftRightLine({ left: name || 'Project', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 4 });
        if (tech.length > 0) {
          const techLine = tech.map((t) => t.trim()).filter(Boolean).slice(0, 18).join('  •  ');
          if (techLine) {
            drawBlock(techLine, fReg, S.meta, cMid, ML, CW, 3);
            cursorY -= 2;
          }
        }
        for (const bullet of bullets.slice(0, 4)) {
          drawBullet(bullet);
        }
        cursorY -= 2;
      }
    }

    // ── SECTION 6 — Highlights ───────────────────────────────────────────
    if (content.resumeBullets && content.resumeBullets.length > 0) {
      drawSectionHeader('Highlights');
      for (const bullet of content.resumeBullets.slice(0, 8)) {
        if (bullet.trim()) drawBullet(bullet.trim());
      }
    }

    // ── SECTION 7 — Education ────────────────────────────────────────────
    if (profile.education && profile.education.length > 0) {
      const validEdu = profile.education.filter((e: { degree: string; institution: string }) => e.degree.trim() || e.institution.trim());
      if (validEdu.length > 0) {
        drawSectionHeader('Education');
        for (const edu of validEdu) {
          const degree = (edu.degree ?? '').trim();
          const inst = (edu.institution ?? '').trim();
          const year = (edu.year ?? '').trim();

          const headline = [degree, inst].filter(Boolean).join(' — ');
          if (!headline && !year) continue;

          drawLeftRightLine({ left: headline, right: year, sizeLeft: S.body, sizeRight: S.meta, fontLeft: fBold, fontRight: fReg, gapBelow: 2 });
          cursorY -= 3;
        }
      }
    }

    // ── Footer on every page ─────────────────────────────────────────────
    const pageCount = pdf.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const p = pdf.getPage(i);
      p.drawLine({
        start: { x: ML, y: MB - 8 },
        end:   { x: PAGE_W - MR, y: MB - 8 },
        thickness: 0.4,
        color: cRule,
      });
      const label = `Page ${i + 1} of ${pageCount}`;
      const w = fReg.widthOfTextAtSize(label, S.small);
      p.drawText(label, { x: PAGE_W - MR - w, y: MB - 20, size: S.small, font: fReg, color: cMid });
    }

    // ── Serialise ─────────────────────────────────────────────────────────
    const bytes  = await pdf.save();
    const base64 = Buffer.from(bytes).toString('base64');

    await PortfolioFeedback.create({
      userId,
      generationId,
      eventType: 'export_pdf',
      metadata: { bytes: bytes.length },
    });

    return {
      fileName: `adjusted-resume-${generationId}.pdf`,
      base64,
    };
  });
}

export async function recordGenerationFeedback(input: unknown) {
  return withTelemetry('vault.recordGenerationFeedback', {}, async () => {
    const user = await requireSessionUser();
    const parsed = feedbackEventSchema.parse(input);

    await connectToDatabase();

    if (!Types.ObjectId.isValid(parsed.generationId)) {
      throw new Error('Invalid generationId');
    }

    const generation = await PortfolioGeneration.findOne({
      _id: parsed.generationId,
      userId: user.id,
    }).lean();

    if (!generation) {
      throw new Error('Generation not found');
    }

    await PortfolioFeedback.create({
      userId: user.id,
      generationId: parsed.generationId,
      eventType: parsed.eventType,
      metadata: parsed.metadata ?? null,
    });

    return { ok: true };
  });
}

export async function listVaultProjects(input?: { limit?: number; page?: number }) {
  return withTelemetry('vault.listVaultProjects', {}, async () => {
    const user = await requireSessionUser();
    const userId = user.id;
    const limit = Math.min(input?.limit ?? 20, 100);
    const page = Math.max(input?.page ?? 1, 1);
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const [projects, total] = await Promise.all([
      Project.find({ userId }, { embedding: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments({ userId }),
    ]);

    return {
      projects: projects.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        description: p.description,
        techStack: p.techStack ?? [],
        tags: p.tags ?? [],
        impactScore: p.impactScore,
        createdAt: (p as unknown as { createdAt: Date }).createdAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });
}

export async function listPortfolioGenerations(input?: { limit?: number; page?: number }) {
  return withTelemetry('vault.listPortfolioGenerations', {}, async () => {
    const user = await requireSessionUser();
    const userId = user.id;
    const limit = Math.min(input?.limit ?? 10, 50);
    const page = Math.max(input?.page ?? 1, 1);
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const [generations, total] = await Promise.all([
      PortfolioGeneration.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PortfolioGeneration.countDocuments({ userId }),
    ]);

    return {
      generations: generations.map((g) => ({
        id: g._id.toString(),
        jobDescription: (g.jobDescription as string).slice(0, 200),
        outputFormat: g.outputFormat as string,
        topK: g.topK as number,
        mustHaveSkills: (g.mustHaveSkills ?? []) as string[],
        model: g.model as string,
        createdAt: (g as unknown as { createdAt: Date }).createdAt?.toISOString() ?? null,
        summary: (g.content as { summary?: string })?.summary?.slice(0, 200) ?? '',
        keywordsCount: ((g.content as { keywords?: string[] })?.keywords ?? []).length,
        sectionsCount: ((g.content as { sections?: unknown[] })?.sections ?? []).length,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });
}

export async function getFeedbackAnalytics(input: unknown) {
  return withTelemetry('vault.getFeedbackAnalytics', {}, async () => {
    const user = await requireSessionUser();
    const { windowDays } = analyticsSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [eventCounts, generationCount] = await Promise.all([
    PortfolioFeedback.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: from },
        },
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
    ]),
    PortfolioGeneration.countDocuments({
      userId,
      createdAt: { $gte: from },
    }),
  ]);

    const counts = {
    view: 0,
    edit: 0,
    export_pdf: 0,
    apply: 0,
    positive: 0,
    negative: 0,
  };

    for (const row of eventCounts) {
      if (row._id in counts) {
        const key = row._id as keyof typeof counts;
        counts[key] = row.count;
      }
    }

    const feedbackTotal = counts.positive + counts.negative;
    const positiveRate = feedbackTotal > 0 ? counts.positive / feedbackTotal : 0;
    const conversionRate = counts.export_pdf > 0 ? counts.apply / counts.export_pdf : 0;

    return {
      windowDays,
      generationCount,
      events: counts,
      rates: {
        positiveRate,
        exportToApplyRate: conversionRate,
      },
    };
  });
}

export async function getProfile() {
  return withTelemetry('vault.getProfile', {}, async () => {
    const user = await requireSessionUser();
    await connectToDatabase();

    const doc = await UserProfile.findOne({ userId: user.id }).lean();
    return {
      name:      (doc?.name      as string | undefined) ?? '',
      title:     (doc?.title     as string | undefined) ?? '',
      email:     (doc?.email     as string | undefined) ?? '',
      phone:     (doc?.phone     as string | undefined) ?? '',
      location:  (doc?.location  as string | undefined) ?? '',
      linkedin:  (doc?.linkedin  as string | undefined) ?? '',
      portfolio: (doc?.portfolio as string | undefined) ?? '',
      summary:   (doc?.summary   as string | undefined) ?? '',
      education: (doc?.education as Array<{ degree: string; institution: string; year: string }> | undefined) ?? [],
    };
  });
}

export async function saveProfile(input: unknown) {
  return withTelemetry('vault.saveProfile', {}, async () => {
    const user = await requireSessionUser();
    const parsed = userProfileSchema.parse(input);
    await connectToDatabase();

    await UserProfile.findOneAndUpdate(
      { userId: user.id },
      { $set: { ...parsed, userId: user.id } },
      { upsert: true, new: true }
    );

    revalidatePath('/profile');
    return { ok: true };
  });
}