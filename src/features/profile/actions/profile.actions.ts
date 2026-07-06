'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { UserProfile } from '@/lib/db/user-profile.model';
import { requireSessionUser } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import { withTelemetry } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────

const userProfileSchema = z.object({
  name:      z.string().max(120).default(''),
  title:     z.string().max(120).default(''),
  email:     z.string().max(200).default(''),
  phone:     z.string().max(60).default(''),
  location:  z.string().max(120).default(''),
  linkedin:  z.string().max(300).default(''),
  portfolio: z.string().max(300).default(''),
  summary:   z.string().max(1000).default(''),
  education: z
    .array(
      z.object({
        degree:      z.string().max(120).default(''),
        institution: z.string().max(120).default(''),
        year:        z.string().max(40).default(''),
      })
    )
    .default([]),
});

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

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
      education: (
        (doc?.education ?? []) as Array<{
          degree?: string;
          institution?: string;
          year?: string;
        }>
      ).map((entry) => ({
        degree: String(entry.degree ?? ''),
        institution: String(entry.institution ?? ''),
        year: String(entry.year ?? ''),
      })),
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
