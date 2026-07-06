import { embedMany } from 'ai';
import { embeddingModel } from '@/lib/models';

/** Batch-embed vault project texts in as few API round-trips as possible. */
export async function embedVaultTexts(values: string[]) {
  if (values.length === 0) {
    return [] as number[][];
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values,
    maxParallelCalls: 2,
  });

  return embeddings;
}
