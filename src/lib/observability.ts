type TelemetryLevel = 'info' | 'error';

type TelemetryEvent = {
  level: TelemetryLevel;
  operation: string;
  durationMs?: number;
  timestamp: string;
  context?: Record<string, unknown>;
  message?: string;
};

export function logTelemetry(event: TelemetryEvent) {
  const payload = JSON.stringify(event);

  if (event.level === 'error') {
    console.error(payload);
    return;
  }

  console.log(payload);
}

export async function withTelemetry<T>(
  operation: string,
  context: Record<string, unknown>,
  action: () => Promise<T>
) {
  const startedAt = Date.now();

  try {
    const result = await action();

    logTelemetry({
      level: 'info',
      operation,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      context,
    });

    return result;
  } catch (error) {
    logTelemetry({
      level: 'error',
      operation,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      context,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}
