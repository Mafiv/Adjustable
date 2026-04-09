import {
  listPortfolioGenerations,
  exportPortfolioPdf,
  recordGenerationFeedback,
  getFeedbackAnalytics,
} from '@/app/actions/vault';
import ExportsClient from './ExportsClient';
import crypto from 'crypto';

export const metadata = {
  title: 'Exports — Adjustable',
  description: 'Export portfolio generations to PDF, record feedback, and view analytics.',
};

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string; data?: unknown };

function toStr(v: FormDataEntryValue | null) {
  return typeof v === 'string' ? v : '';
}

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; id?: string }>;
}) {
  const { page: pageStr, id: initialId = '' } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? '1'));

  let data: Awaited<ReturnType<typeof listPortfolioGenerations>> | null = null;
  try {
    data = await listPortfolioGenerations({ limit: 10, page });
  } catch {
    data = { generations: [], total: 0, page: 1, limit: 10, pages: 0 };
  }

  const firstId = data.generations[0]?.id ?? '';
  const resolvedInitialId = initialId || firstId;

  async function exportPdfAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const result = await exportPortfolioPdf({ generationId: toStr(formData.get('generationId')) });
      return { status: 'success', data: result };
    } catch (err) {
      const base = err instanceof Error ? err : new Error('Export failed.');
      return { status: 'error', message: base.message, data: { debugId: crypto.randomUUID() } };
    }
  }

  async function feedbackAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const result = await recordGenerationFeedback({
        generationId: toStr(formData.get('generationId')),
        eventType: toStr(formData.get('eventType')),
        metadata: { note: toStr(formData.get('note')) || undefined },
      });
      return { status: 'success', data: result };
    } catch (err) {
      const base = err instanceof Error ? err : new Error('Feedback failed.');
      return { status: 'error', message: base.message };
    }
  }

  async function analyticsAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    'use server';
    try {
      const result = await getFeedbackAnalytics({
        windowDays: Number(toStr(formData.get('windowDays')) || 30),
      });
      return { status: 'success', data: result };
    } catch (err) {
      const base = err instanceof Error ? err : new Error('Analytics failed.');
      return { status: 'error', message: base.message };
    }
  }

  return (
    <ExportsClient
      generations={data.generations}
      total={data.total}
      pages={data.pages}
      page={data.page}
      exportPdfAction={exportPdfAction}
      feedbackAction={feedbackAction}
      analyticsAction={analyticsAction}
      initialId={resolvedInitialId}
    />
  );
}
