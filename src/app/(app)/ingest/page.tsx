import { shredResumeToVault, addProjectToVault } from '@/app/actions/vault';
import { parseResumeFile } from '@/lib/resume-parser';
import IngestClient from './IngestClient';
import crypto from 'crypto';

export const maxDuration = 300;

export const metadata = {
  title: 'Ingest — Adjustable',
  description: 'Upload your resume or add individual projects to grow your vault.',
};

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };

function serializeError(error: unknown, action: string): ActionState {
  const debugId = crypto.randomUUID();
  const base = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  return { status: 'error', message: base.message, data: { debugId, action } };
}

function toStr(v: FormDataEntryValue | null) {
  return typeof v === 'string' ? v : '';
}

function parseCommaList(v: FormDataEntryValue | null) {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function IngestPage() {
  async function shredAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const file = formData.get('resumeFile');
      if (!(file instanceof File)) throw new Error('Please upload a resume file.');

      const parseStarted = Date.now();
      const parsed = await parseResumeFile(file);
      const parseDurationMs = Date.now() - parseStarted;

      if (!parsed.text) throw new Error('Could not extract text from the uploaded file.');

      const result = await shredResumeToVault({
        resumeText: parsed.text,
        maxEntities: Number(toStr(formData.get('maxEntities')) || 12),
      });

      return {
        status: 'success',
        data: {
          sourceType: parsed.detectedType,
          parseDurationMs,
          ...result,
        },
      };
    } catch (err) {
      return serializeError(err, 'shredAction');
    }
  }

  async function addAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const result = await addProjectToVault({
        rawInput: toStr(formData.get('rawInput')),
        tags: parseCommaList(formData.get('tags')),
      });
      return { status: 'success', data: result };
    } catch (err) {
      return serializeError(err, 'addProjectAction');
    }
  }

  return <IngestClient shredResumeAction={shredAction} addProjectAction={addAction} />;
}
