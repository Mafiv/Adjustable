export function isRateLimitError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /too many request|rate limit|429/i.test(text);
}

export function formatRateLimitMessage(context: string) {
  return `${context}: GitHub Models rate limit hit. Wait a minute and try again, or reduce max entities on the ingest form.`;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetryOnRateLimit<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    label?: string;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 8_000;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = isRateLimitError(error) && attempt < maxAttempts - 1;
      if (!canRetry) {
        if (isRateLimitError(error) && options?.label) {
          throw new Error(formatRateLimitMessage(options.label), { cause: error });
        }
        throw error;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}
