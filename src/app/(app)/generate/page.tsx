import {
  generatePortfolioFromJob,
  exportPortfolioPdf,
  getGeneratePreflight,
} from '@/app/actions/vault';
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

export default async function GeneratePage() {
  const preflight = await getGeneratePreflight();

  async function generateAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const forceExport = formData.get('forceExport') === 'on';
      const result = await generatePortfolioFromJob({
        jobDescription: toStr(formData.get('jobDescription')),
        outputFormat: toStr(formData.get('outputFormat')) || 'sections',
        topK: Number(toStr(formData.get('topK')) || 8),
        mustHaveSkills: parseCommaList(formData.get('mustHaveSkills')),
        tone: toStr(formData.get('tone')) || undefined,
        audience: toStr(formData.get('audience')) || undefined,
        includeRationale: formData.get('includeRationale') === 'on',
        forceExport,
      });

      if (result.blockedExport) {
        return {
          status: 'success',
          data: { ...result, pdfBlocked: true },
        };
      }

      try {
        const pdf = await exportPortfolioPdf({
          generationId: result.generationId,
          forceExport,
        });
        return { status: 'success', data: { ...result, pdf } };
      } catch (pdfErr) {
        const pdfMessage = pdfErr instanceof Error ? pdfErr.message : 'PDF export failed.';
        return { status: 'success', data: { ...result, pdfError: pdfMessage } };
      }
    } catch (err) {
      const base = err instanceof Error ? err : new Error('Generation failed.');
      return { status: 'error', message: base.message, data: { debugId: crypto.randomUUID() } };
    }
  }

  async function exportPdfAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const pdf = await exportPortfolioPdf({
        generationId: toStr(formData.get('generationId')),
        forceExport: formData.get('forceExport') === 'on',
      });
      return { status: 'success', data: { pdf } };
    } catch (err) {
      const base = err instanceof Error ? err : new Error('PDF export failed.');
      return { status: 'error', message: base.message };
    }
  }

  return (
    <GenerateClient
      preflight={preflight}
      generateAction={generateAction}
      exportPdfAction={exportPdfAction}
    />
  );
}
