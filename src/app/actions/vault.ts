'use server';

import { embed } from 'ai';
import { embeddingModel } from '@/lib/models';
import { embedVaultTexts } from '@/lib/vault-embeddings';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { PortfolioFeedback, PortfolioGeneration, Project, UserProfile } from '@/lib/db/models';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { requireSessionUser } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import {
  buildFingerprint,
  isQualityEntity,
  normalizeTags,
  normalizeTechStack,
} from '@/lib/vault-utils';
import {
  buildGenerationPrompt,
  generationOutputLooseSchema,
  normalizeGenerationOutput,
} from '@/lib/cv-generation';
import { detectJobDescriptionGaps, projectMatchesMustHaveSkills } from '@/lib/cv-gaps';
import { buildCvPdf } from '@/lib/cv-pdf';
import {
  getProfileCompletenessSummary,
  normalizeCvProfile,
  type CvProfile,
} from '@/lib/cv-profile';
import { validateGenerationCompleteness } from '@/lib/cv-validation';
import { isRefusalOrMetaText, rawOutputLooksLikeRefusal } from '@/lib/cv-generation-guards';
import { retrieveProjectsForJob } from '@/lib/cv-retrieval';
import { logTelemetry, withTelemetry } from '@/lib/observability';
import {
  generateObjectWithNativeInference,
  isModelNotFoundError,
} from '@/lib/ai/github-inference';
import { extractPersonalInfoHeuristics } from '@/lib/ai/heuristics';
import {
  buildResumeExtractionPrompt,
  getResumeFieldsNotInCv,
  hasAnyMergedProfileValue,
  mergeResumeIntoProfile,
  resumePersonalInfoSchema,
} from '@/lib/resume-profile';

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
  topK: z.number().int().min(1).max(20).default(8),
  mustHaveSkills: z.array(z.string()).default([]),
  tone: z.string().optional(),
  audience: z.string().optional(),
  includeRationale: z.boolean().default(false),
  forceExport: z.boolean().default(false),
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
  github:    z.string().max(300).default(''),
  portfolio: z.string().max(300).default(''),
  summary:   z.string().max(1000).default(''),
  languages: z.array(z.object({
    name:        z.string().max(80).default(''),
    proficiency: z.enum(['basic', 'intermediate', 'advanced', 'native', '']).default(''),
  })).default([]),
  education: z.array(z.object({
    degree:      z.string().max(120).default(''),
    institution: z.string().max(120).default(''),
    startDate:   z.string().max(40).default(''),
    endDate:     z.string().max(40).default(''),
    location:    z.string().max(120).default(''),
    honors:      z.string().max(300).default(''),
    coursework:  z.string().max(500).default(''),
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


// generation schemas live in src/lib/cv-generation.ts

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

type AtomicEntity = z.infer<typeof atomicEntitySchema>;

async function extractResumeEntities(resumeText: string, maxEntities: number) {
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

    return {
      extractionMode: 'llm' as const,
      entities: object.entities
        .slice(0, maxEntities)
        .map((entity, index) => normalizeAtomicEntity(entity, index)),
    };
  } catch (error) {
    if (!isModelNotFoundError(error)) {
      throw error;
    }

    return {
      extractionMode: 'heuristic' as const,
      entities: heuristicResumeEntities(resumeText, maxEntities),
    };
  }
}

async function updateProfileFromResume(userId: string, resumeText: string) {
  let personalInfo: z.infer<typeof resumePersonalInfoSchema> | null = null;
  let profileAutoUpdated = false;
  let profileFieldsNotInResume: string[] = [];

  const applyResumeProfile = async (heuristicsOnly = false) => {
    const existingProfile = await UserProfile.findOne({ userId }).lean();
    const heuristics = extractPersonalInfoHeuristics(resumeText);
    const mergedProfile = mergeResumeIntoProfile({
      existing: existingProfile as Parameters<typeof mergeResumeIntoProfile>[0]['existing'],
      personalInfo,
      heuristics,
      heuristicsOnly,
    });

    if (!heuristicsOnly) {
      profileFieldsNotInResume = getResumeFieldsNotInCv({ personalInfo, heuristics });
    }

    if (hasAnyMergedProfileValue(mergedProfile)) {
      await UserProfile.findOneAndUpdate(
        { userId },
        { $set: mergedProfile },
        { upsert: true, new: true }
      );
      profileAutoUpdated = true;
    }
  };

  try {
    const { object } = await generateObjectWithNativeInference({
      schema: resumePersonalInfoSchema,
      prompt: buildResumeExtractionPrompt(resumeText),
    });
    personalInfo = object;
    await applyResumeProfile(false);
  } catch {
    try {
      await applyResumeProfile(true);
    } catch {
      // Best effort only.
    }
  }

  return {
    personalInfoExtracted: Boolean(personalInfo),
    profileAutoUpdated,
    profileFieldsNotInResume,
  };
}

async function insertShreddedVaultEntities(userId: string, insertableEntities: AtomicEntity[]) {
  if (insertableEntities.length === 0) {
    return [];
  }

  const embeddingInputs = insertableEntities.map((entity) =>
    buildEmbeddingText({
      title: entity.title,
      description: entity.description,
      techStack: entity.techStack,
    })
  );

  const embeddings = await embedVaultTexts(embeddingInputs);

  const docs = insertableEntities.map((entity, index) => ({
    userId,
    title: entity.title,
    description: entity.description,
    fingerprint: buildFingerprint({
      title: entity.title,
      description: entity.description,
    }),
    techStack: entity.techStack,
    impactScore: entity.impactScore,
    tags: entity.tags,
    embedding: embeddings[index] ?? [],
  }));

  return Project.insertMany(docs);
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

    const [{ extractionMode, entities }, profileResult] = await Promise.all([
      extractResumeEntities(resumeText, maxEntities),
      updateProfileFromResume(userId, resumeText),
    ]);

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

    const inserted = await insertShreddedVaultEntities(userId, insertableEntities);

    revalidatePath('/vault');
    revalidatePath('/profile');

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
      ...profileResult,
    };
  });
}

export async function getGeneratePreflight() {
  return withTelemetry('vault.getGeneratePreflight', {}, async () => {
    const user = await requireSessionUser();
    await connectToDatabase();

    const [profileDoc, projectCount] = await Promise.all([
      UserProfile.findOne({ userId: user.id }).lean(),
      Project.countDocuments({ userId: user.id }),
    ]);

    const profile = normalizeCvProfile(profileDoc as Partial<CvProfile> | null);
    const profileCompleteness = getProfileCompletenessSummary(profile);

    return {
      vaultProjectCount: projectCount,
      profileCompleteness,
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
      forceExport,
    } = generatePortfolioSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    const { embedding } = await embed({
      model: embeddingModel,
      value: jobDescription,
    });

    const retrieval = await retrieveProjectsForJob({
      userId,
      jobDescription,
      queryVector: embedding,
      topK,
    });

    const { candidates, retrievalMode, vectorIndex, numCandidates, vaultProjectCount, projectsWithEmbeddings } =
      retrieval;

    logTelemetry({
      level: 'info',
      operation: 'vault.generatePortfolioFromJob.retrieval',
      timestamp: new Date().toISOString(),
      context: {
        topK,
        numCandidates,
        retrievalMode,
        vaultProjectCount,
        projectsWithEmbeddings,
        candidateCount: candidates.length,
        candidateTitles: candidates.map((project) => project.title),
        mustHaveSkills,
      },
    });

    if (vaultProjectCount === 0) {
      throw new Error(
        'Your vault is empty. Add projects via Ingest or Vault before generating a tailored CV.'
      );
    }

    const filtered = mustHaveSkills.length
      ? candidates.filter((project) => projectMatchesMustHaveSkills(project, mustHaveSkills))
      : candidates;

    const mustHaveSkillsFilterApplied = mustHaveSkills.length > 0;
    const mustHaveSkillsFilterReduced =
      mustHaveSkillsFilterApplied && filtered.length < candidates.length;

    let selectedProjects = filtered.length > 0 ? filtered : candidates;

    if (mustHaveSkillsFilterApplied && filtered.length === 0) {
      logTelemetry({
        level: 'info',
        operation: 'vault.generatePortfolioFromJob.mustHaveSkillsFallback',
        timestamp: new Date().toISOString(),
        context: {
          mustHaveSkills,
          message: 'Must-have skills filter removed all candidates; falling back to unfiltered vector results.',
        },
      });
      selectedProjects = candidates;
    }

    if (selectedProjects.length === 0) {
      throw new Error(
        retrievalMode === 'vector'
          ? 'Vector search returned no matching projects for this job description. Your vault has projects but they may be missing embeddings — try re-ingesting your resume, or add projects manually.'
          : 'No projects could be selected from your vault for this job description.'
      );
    }

    const mappedProjects = selectedProjects.map((project) => ({
      id: project._id.toString(),
      title: project.title,
      description: project.description,
      techStack: project.techStack ?? [],
      impactScore: project.impactScore,
      tags: project.tags ?? [],
    }));

    const prompt = buildGenerationPrompt({
      jobDescription,
      outputFormat,
      tone,
      audience,
      mustHaveSkills,
      includeRationale,
      projects: mappedProjects,
    });

    const { object: rawObject, modelId } = await generateObjectWithNativeInference({
      schema: generationOutputLooseSchema,
      prompt,
    });

    const refusalDetected = rawOutputLooksLikeRefusal(rawObject);

    logTelemetry({
      level: 'info',
      operation: 'vault.generatePortfolioFromJob.llm',
      timestamp: new Date().toISOString(),
      context: {
        modelId,
        promptLength: prompt.length,
        refusalDetected,
        rawSummaryLength: rawObject.summary?.length ?? 0,
        rawWorkExperienceCount: rawObject.workExperience?.length ?? 0,
        rawProjectCount: rawObject.projects?.length ?? 0,
        rawSectionCount: rawObject.sections?.length ?? 0,
      },
    });

    if (process.env.CV_GENERATION_DEBUG === 'true') {
      logTelemetry({
        level: 'info',
        operation: 'vault.generatePortfolioFromJob.llm.debug',
        timestamp: new Date().toISOString(),
        context: { promptPreview: prompt.slice(0, 4000), rawObject },
      });
    }

    const normalizedOutput = normalizeGenerationOutput(rawObject, selectedProjects);

    const [allVaultProjects, profileDoc] = await Promise.all([
      Project.find({ userId }, { techStack: 1, tags: 1, title: 1, description: 1 }).lean(),
      UserProfile.findOne({ userId }).lean(),
    ]);

    const jdGaps = detectJobDescriptionGaps({
      jobDescription,
      keywords: normalizedOutput.keywords,
      mustHaveSkills,
      vaultProjects: allVaultProjects,
    });

    const profile = normalizeCvProfile(profileDoc as Partial<CvProfile> | null);
    const profileCompleteness = getProfileCompletenessSummary(profile);
    const completeness = validateGenerationCompleteness({
      content: normalizedOutput,
      matchedProjectCount: selectedProjects.length,
      strict: !forceExport,
      refusalDetected,
    });

    if (refusalDetected && !forceExport) {
      throw new Error(
        'AI returned explanatory text instead of grounded CV content. Your vault projects were matched — try generating again, or add richer project descriptions in your vault.'
      );
    }

    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

    const generation = await PortfolioGeneration.create({
      userId,
      jobDescription,
      outputFormat,
      projectIds: selectedProjects.map((project) => project._id),
      content: normalizedOutput,
      promptHash,
      model: modelId,
      vectorIndex,
      topK,
      mustHaveSkills,
    });

    return {
      generationId: generation._id.toString(),
      format: outputFormat,
      content: normalizedOutput,
      retrieval: {
        topK,
        numCandidates,
        retrievalMode,
        vaultProjectCount,
        projectsWithEmbeddings,
        candidateCount: candidates.length,
        selectedCount: selectedProjects.length,
        candidateTitles: candidates.map((project) => project.title as string),
        mustHaveSkillsFilterApplied,
        mustHaveSkillsFilterReduced,
        mustHaveSkillsFilterCount: filtered.length,
      },
      jdGaps,
      profileCompleteness,
      completeness,
      blockedExport: completeness.blocked && !forceExport,
    };
  });
}

export async function exportPortfolioPdf(input: unknown) {
  return withTelemetry('vault.exportPortfolioPdf', {}, async () => {
    const user = await requireSessionUser();
    const parsed = exportPdfSchema
      .extend({ forceExport: z.boolean().optional() })
      .parse(input);
    const { generationId, forceExport = false } = parsed;
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

    const matchedProjects = await Project.find({
      _id: { $in: generation.projectIds ?? [] },
      userId,
    }).lean();

    const content = normalizeGenerationOutput(
      generation.content as z.infer<typeof generationOutputLooseSchema>,
      matchedProjects
    );
    const matchedProjectCount = matchedProjects.length;

    const completeness = validateGenerationCompleteness({
      content,
      matchedProjectCount,
      strict: !forceExport,
      refusalDetected:
        isRefusalOrMetaText(content.summary) ||
        content.workExperience.some(
          (entry) =>
            isRefusalOrMetaText(entry.company) ||
            isRefusalOrMetaText(entry.role) ||
            entry.bullets.some((bullet) => isRefusalOrMetaText(bullet))
        ),
    });

    if (!completeness.ok && !forceExport) {
      throw new Error(
        `PDF export blocked: generated content is too sparse (${completeness.warnings.join(' ')})`
      );
    }

    if (completeness.warnings.length > 0) {
      logTelemetry({
        level: 'info',
        operation: 'vault.exportPortfolioPdf.completenessWarning',
        timestamp: new Date().toISOString(),
        context: { generationId, warnings: completeness.warnings, metrics: completeness.metrics },
      });
    }

    const profileDoc = await UserProfile.findOne({ userId }).lean();
    const profile = normalizeCvProfile(profileDoc as Partial<CvProfile> | null);

    const { base64, bytes, renderStats, pageCount } = await buildCvPdf(content, profile);

    logTelemetry({
      level: 'info',
      operation: 'vault.exportPortfolioPdf.renderStats',
      timestamp: new Date().toISOString(),
      context: { generationId, pageCount, renderStats, metrics: completeness.metrics },
    });

    await PortfolioFeedback.create({
      userId,
      generationId,
      eventType: 'export_pdf',
      metadata: { bytes: bytes.length, pageCount, renderStats },
    });

    return {
      fileName: `adjusted-resume-${generationId}.pdf`,
      base64,
      completeness,
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
    const profile = normalizeCvProfile(doc as Partial<CvProfile> | null);
    const completeness = getProfileCompletenessSummary(profile);

    return { ...profile, completeness };
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
