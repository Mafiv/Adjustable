'use server';

import { embed } from 'ai';
import { embeddingModel } from '@/lib/models';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { Project } from '@/lib/db/project.model';
import { Types } from 'mongoose';
import { requireSessionUser } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import {
  buildFingerprint,
  normalizeTags,
  normalizeTechStack,
} from '@/lib/vault-utils';
import { withTelemetry } from '@/lib/observability';
import { generateObjectWithNativeInference } from '@/lib/ai/github-inference';
import { normalizeAtomicEntity } from '@/lib/ai/heuristics';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const addProjectSchema = z.object({
  rawInput: z.string().min(10),
  tags: z.array(z.string()).optional(),
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

const atomicEntityLooseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  impactScore: z.number().min(1).max(10).optional(),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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
// Actions
// ─────────────────────────────────────────────────────────────

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
