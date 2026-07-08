export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  const wrapped = Promise.resolve(promise);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    wrapped
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function getIngestLlmTimeoutMs() {
  const raw = Number(process.env.INGEST_LLM_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

export function getIngestEmbedTimeoutMs(itemCount = 1) {
  const base = Number(process.env.INGEST_EMBED_TIMEOUT_MS ?? 90_000);
  const perItem = Number(process.env.INGEST_EMBED_TIMEOUT_PER_ITEM_MS ?? 20_000);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 90_000;
  const safePerItem = Number.isFinite(perItem) && perItem > 0 ? perItem : 20_000;
  const scaled = safeBase + Math.max(0, itemCount - 1) * safePerItem;
  return Math.min(600_000, scaled);
}
