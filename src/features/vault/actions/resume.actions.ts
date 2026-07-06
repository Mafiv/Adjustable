'use server';

import { embed } from 'ai';
import { embeddingModel } from '@/lib/models';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { Project } from '@/lib/db/project.model';
import { UserProfile } from '@/lib/db/user-profile.model';
import { requireSessionUser } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import {
  buildFingerprint,
  normalizeTags,
  normalizeTechStack,
  isQualityEntity,
} from '@/lib/vault-utils';
import { withTelemetry } from '@/lib/observability';
import {
  generateObjectWithNativeInference,
  isModelNotFoundError,
} from '@/lib/ai/github-inference';
import {
  heuristicResumeEntities,
  normalizeAtomicEntity,
  extractPersonalInfoHeuristics,
} from '@/lib/ai/heuristics';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const shredResumeSchema = z.object({
  resumeText: z.string().min(40),
  maxEntities: z.number().int().min(1).max(30).default(12),
});

const atomicEntityLooseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  impactScore: z.number().min(1).max(10).optional(),
});

const resumePersonalInfoSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  summary: z.string().optional(),
  education: z
    .array(
      z.object({
        degree: z.string().optional(),
        institution: z.string().optional(),
        year: z.string().optional(),
      })
    )
    .optional(),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────

export async function shredResumeToVault(input: unknown) {
  return withTelemetry('vault.shredResumeToVault', {}, async () => {
    const user = await requireSessionUser();
    const { resumeText, maxEntities } = shredResumeSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    let entities: Array<{
      title: string;
      description: string;
      techStack: string[];
      tags: string[];
      impactScore: number;
    }> = [];
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
        ? await Project.find(
            { userId, fingerprint: { $in: fingerprints } },
            { fingerprint: 1 }
          ).lean()
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

    const runProfileUpdate = async (heuristicsOnly = false) => {
      const existingProfile = await UserProfile.findOne({ userId }).lean();
      const heuristics = extractPersonalInfoHeuristics(resumeText);

      const existingEducation = (
        (existingProfile?.education as Array<{
          degree?: string;
          institution?: string;
          year?: string;
        }> | undefined) ?? []
      )
        .map((edu) => ({
          degree: firstNonEmpty(edu.degree),
          institution: firstNonEmpty(edu.institution),
          year: firstNonEmpty(edu.year),
        }))
        .filter((edu) => edu.degree || edu.institution || edu.year);

      const extractedEducation = heuristicsOnly
        ? []
        : (personalInfo?.education ?? [])
            .map((edu) => ({
              degree: firstNonEmpty(edu.degree),
              institution: firstNonEmpty(edu.institution),
              year: firstNonEmpty(edu.year),
            }))
            .filter((edu) => edu.degree || edu.institution || edu.year);

      const mergedEducation =
        existingEducation.length > 0 ? existingEducation : extractedEducation;

      const mergedProfile = {
        name: firstNonEmpty(
          existingProfile?.name as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.name,
          heuristics.name
        ),
        title: firstNonEmpty(
          existingProfile?.title as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.title,
          heuristics.title
        ),
        email: firstNonEmpty(
          existingProfile?.email as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.email,
          heuristics.email
        ),
        phone: firstNonEmpty(
          existingProfile?.phone as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.phone,
          heuristics.phone
        ),
        location: firstNonEmpty(
          existingProfile?.location as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.location
        ),
        linkedin: firstNonEmpty(
          existingProfile?.linkedin as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.linkedin,
          heuristics.linkedin
        ),
        portfolio: firstNonEmpty(
          existingProfile?.portfolio as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.portfolio,
          heuristics.portfolio
        ),
        summary: firstNonEmpty(
          existingProfile?.summary as string | undefined,
          heuristicsOnly ? undefined : personalInfo?.summary
        ),
        education: mergedEducation,
      };

      if (hasAnyProfileValue(mergedProfile)) {
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
        prompt: [
          'Extract personal information from this resume text.',
          'Infer the candidate name from the resume header even if the label "full name" is not explicitly written.',
          'IMPORTANT: Return the name as a clean full name only — no job titles, no extra words. Example: "Abdi Sileshi Worku", NOT "Abdi Sileshi Worku Software".',
          'Prioritize contact/header details: name, title, email, phone, location, linkedin, portfolio.',
          'Return only the information that is explicitly present in the resume.',
          'For phone numbers, normalize to international format with spaces: e.g. "+251 988 734 632".',
          'For education, extract all degrees with their institutions and years.',
          'IMPORTANT: Fix common typos in education data — e.g. "unversity" → "University", "Engginering" → "Engineering", "AdamaScience" → "Adama Science".',
          'For links (linkedin, portfolio), return only the URL or username.',
          `Resume:\n${resumeText.slice(0, 15000)}`,
        ].join('\n'),
      });
      personalInfo = object;
      await runProfileUpdate(false);
    } catch {
      try {
        await runProfileUpdate(true);
      } catch {
        // Best effort only.
      }
    }

    revalidatePath('/vault');

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
      personalInfoExtracted: personalInfo !== null,
      profileAutoUpdated,
    };
  });
}
