import { embed } from 'ai';
import { withRetryOnRateLimit, sleep } from '@/lib/ai/retry';
import { getIngestEmbedTimeoutMs, withTimeout } from '@/lib/async-timeout';
import { embeddingModel } from '@/lib/models';

function getEmbedGapMs() {
  const raw = Number(process.env.INGEST_EMBED_GAP_MS ?? 600);
  return Number.isFinite(raw) && raw >= 0 ? raw : 600;
}

function getPerItemEmbedTimeoutMs() {
  const raw = Number(process.env.INGEST_EMBED_ITEM_TIMEOUT_MS ?? 45_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 45_000;
}

/** Embed vault texts one at a time to stay under GitHub Models rate limits. */
export async function embedVaultTexts(values: string[]) {
  if (values.length === 0) {
    return [] as number[][];
  }

  const embeddings: number[][] = [];
  const gapMs = getEmbedGapMs();
  const perItemTimeoutMs = getPerItemEmbedTimeoutMs();
  const totalBudgetMs = getIngestEmbedTimeoutMs(values.length);

  const startedAt = Date.now();

  for (let index = 0; index < values.length; index += 1) {
    const elapsed = Date.now() - startedAt;
    const remainingBudget = totalBudgetMs - elapsed;
    if (remainingBudget <= 0) {
      throw new Error(
        `Embedding timed out after ${Math.round(totalBudgetMs / 1000)}s (${index}/${values.length} done). GitHub Models may be rate-limiting — wait a minute and retry with fewer entities.`
      );
    }

    const itemTimeout = Math.min(perItemTimeoutMs, remainingBudget);
    const value = values[index]!;

    const { embedding } = await withTimeout(
      withRetryOnRateLimit(
        () => embed({ model: embeddingModel, value }),
        { label: `Embedding ${index + 1}/${values.length}` }
      ),
      itemTimeout,
      `Embedding item ${index + 1}/${values.length} timed out after ${Math.round(itemTimeout / 1000)}s.`
    );

    embeddings.push(embedding);

    if (index < values.length - 1 && gapMs > 0) {
      await sleep(gapMs);
    }
  }

  return embeddings;
}
