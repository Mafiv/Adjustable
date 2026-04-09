import { generatePortfolioFromJob } from '@/app/actions/vault';
import GenerateClient from './GenerateClient';
import crypto from 'crypto';

export const metadata = {
  title: 'Generate — Adjustable',
  description: 'Generate a tailored portfolio draft from your vault using AI vector search.',
};

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };

function toStr(v: FormDataEntryValue | null) {
  return typeof v === 'string' ? v : '';
}

function parseCommaList(v: FormDataEntryValue | null) {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function GeneratePage() {
  async function generateAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const result = await generatePortfolioFromJob({
        jobDescription: toStr(formData.get('jobDescription')),
        outputFormat: toStr(formData.get('outputFormat')),
        topK: Number(toStr(formData.get('topK')) || 5),
        mustHaveSkills: parseCommaList(formData.get('mustHaveSkills')),
        tone: toStr(formData.get('tone')) || undefined,
        audience: toStr(formData.get('audience')) || undefined,
        includeRationale: formData.get('includeRationale') === 'on',
      });
      return { status: 'success', data: result };
    } catch (err) {
      const base = err instanceof Error ? err : new Error('Generation failed.');
      return { status: 'error', message: base.message, data: { debugId: crypto.randomUUID() } };
    }
  }

  return <GenerateClient generateAction={generateAction} />;
}
