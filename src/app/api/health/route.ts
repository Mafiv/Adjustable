import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { withTelemetry } from '@/lib/observability';

export async function GET() {
  return withTelemetry('api.health.get', {}, async () => {
    try {
      await connectToDatabase();

      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          authSecret: Boolean(process.env.BETTER_AUTH_SECRET),
          modelsToken: Boolean(process.env.GITHUB_MODELS_TOKEN),
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Health check failed',
        },
        { status: 500 }
      );
    }
  });
}
