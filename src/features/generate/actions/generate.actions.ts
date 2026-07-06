'use server';

import { embed } from 'ai';
import { embeddingModel } from '@/lib/models';
import { z } from 'zod';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/db';
import { Project } from '@/lib/db/project.model';
import {
  PortfolioGeneration,
  PortfolioFeedback,
} from '@/lib/db/portfolio.model';
import { Types } from 'mongoose';
import { requireSessionUser } from '@/lib/auth-session';
import { withTelemetry } from '@/lib/observability';
import { generateObjectWithNativeInference } from '@/lib/ai/github-inference';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const generatePortfolioSchema = z.object({
  jobDescription: z.string().min(40),
  outputFormat: z.enum(['sections', 'resume', 'json', 'markdown']).default('sections'),
  topK: z.number().int().min(1).max(20).default(5),
  mustHaveSkills: z.array(z.string()).default([]),
  tone: z.string().optional(),
  audience: z.string().optional(),
  includeRationale: z.boolean().default(false),
});

const skillCategorySchema = z.object({
  category: z.string(),
  skills: z.array(z.string()),
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
  skillCategories: z.array(skillCategorySchema).optional(),
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

const feedbackEventSchema = z.object({
  generationId: z.string().min(1),
  eventType: z.enum(['view', 'edit', 'export_pdf', 'apply', 'positive', 'negative']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const analyticsSchema = z.object({
  windowDays: z.number().int().min(1).max(365).default(30),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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
      : selectedProjects.slice(0, 5).map((project) => ({
          projectId: project._id.toString(),
          evidence: project.description.slice(0, 220),
        }));

  const summary =
    output.summary?.trim() ||
    ensuredSections[0]?.bullets[0] ||
    firstProject?.description?.slice(0, 200) ||
    'Generated portfolio summary.';

  const resumeBullets = (output.resumeBullets ?? [])
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .slice(0, 20);

  const markdown =
    output.markdown?.trim() ||
    [
      '# Portfolio Summary',
      summary,
      ...ensuredSections.map((section) =>
        [`## ${section.title}`, ...section.bullets.map((bullet) => `- ${bullet}`)].join('\n')
      ),
    ].join('\n\n');

  const skillCategories = (output.skillCategories ?? [])
    .filter((cat) => cat.category?.trim() && (cat.skills ?? []).length > 0)
    .map((cat) => ({
      category: cat.category!.trim(),
      skills: (cat.skills ?? []).map((s) => s.trim()).filter(Boolean),
    }))
    .slice(0, 10);

  return generationOutputSchema.parse({
    summary,
    sections: ensuredSections,
    resumeBullets: resumeBullets.length > 0 ? resumeBullets : undefined,
    markdown,
    keywords: keywords.length > 0 ? keywords : ['portfolio'],
    skillCategories: skillCategories.length > 0 ? skillCategories : undefined,
    sources: ensuredSources,
    rationale:
      output.rationale?.map((item) => item.trim()).filter(Boolean).slice(0, 20) || undefined,
  });
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

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

    const vectorIndex = process.env.MONGODB_VECTOR_INDEX ?? 'adjustable-vectors';
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
      '',
      '### CORE RULES:',
      '- Only include relevant information that matches the job description.',
      '- Do NOT invent skills or experience. Stay grounded in the user payload.',
      '- Use strong action verbs (Built, Designed, Optimized, Led, Resolved, Integrated).',
      '- Quantify achievements with REAL measurable impact (e.g., "Improved API response time by 40%", "Reduced production bugs by 60%").',
      '- Focus on IMPACT and OUTCOMES, not generic responsibilities.',
      '- Keep bullet points concise, specific, and high-impact.',
      '- AVOID generic buzzwords like "Proven ability", "results-driven professional". Be specific.',
      '',
      `### JOB DESCRIPTION:\n${jobDescription}`,
      '',
      '### OBJECTIVES:',
      '1. SUMMARY: A 2-4 line professional profile that is SPECIFIC and OUTCOME-FOCUSED. Mention the exact stack, domain, and scale of work.',
      '2. SECTIONS: Group matched projects into logical experience blocks. Each block MUST have:',
      '   - A clear, descriptive project/role name',
      '   - High-impact bullet points with measurable outcomes',
      '   - Start each bullet with a strong action verb + specific result',
      '3. KEYWORDS: Extract matching technical skills and tools from the JD.',
      '4. SKILL_CATEGORIES: Group the extracted keywords into categories. Use: "Frontend", "Backend", "Database", "AI / Tools", "Engineering", "Cloud / DevOps", "Other".',
      '',
      `### FORMAT: ${outputFormat}`,
      includeRationale
        ? '- Include rationale statements in the rationale array explaining why certain projects were selected.'
        : '',
      'Return a JSON object matching the requested schema. Include the "skillCategories" array.',
      `### USER DATA PAYLOAD:\n${JSON.stringify(promptPayload)}`,
    ].join('\n');

    const { object, modelId } = await generateObjectWithNativeInference({
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
      model: modelId,
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
        createdAt:
          (g as unknown as { createdAt: Date }).createdAt?.toISOString() ?? null,
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
    const conversionRate =
      counts.export_pdf > 0 ? counts.apply / counts.export_pdf : 0;

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
