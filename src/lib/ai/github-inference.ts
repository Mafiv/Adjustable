// ─────────────────────────────────────────────────────────────
// AI inference layer — GitHub Models client
// Extracted from src/app/actions/vault.ts
// ─────────────────────────────────────────────────────────────

import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { z } from 'zod';

export const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference';

const DEFAULT_CHAT_MODEL_IDS = [
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
] as const;

export function getChatModelIds(): string[] {
  const configured = process.env.AI_CHAT_MODELS?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : [...DEFAULT_CHAT_MODEL_IDS];
}

export const PRIMARY_CHAT_MODEL_ID = getChatModelIds()[0];
export const SECONDARY_CHAT_MODEL_ID = getChatModelIds()[1] ?? PRIMARY_CHAT_MODEL_ID;
export const NATIVE_CHAT_MODEL_IDS = getChatModelIds();

const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_MODELS_TOKEN;

export const inferenceClient = githubToken
  ? ModelClient(GITHUB_MODELS_ENDPOINT, new AzureKeyCredential(githubToken))
  : null;

export function isModelNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = `${error.name} ${error.message}`.toLowerCase();
  return text.includes('not found') || text.includes('404');
}

/** Reasoning models (e.g. gpt-5) reject non-default temperature on GitHub Models. */
export function modelSupportsCustomTemperature(modelId: string) {
  return !/gpt-5/i.test(modelId);
}

function buildChatCompletionBody(
  modelId: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>
) {
  const body = {
    model: modelId,
    response_format: { type: 'json_object' as const },
    messages,
  };

  if (modelSupportsCustomTemperature(modelId)) {
    return { ...body, temperature: 0.2 };
  }

  return body;
}

export function getUnexpectedErrorMessage(response: { status: string; body?: unknown }) {
  const fallback = `GitHub inference request failed with status ${response.status}.`;

  if (!response.body || typeof response.body !== 'object') {
    return fallback;
  }

  const body = response.body as {
    error?: {
      code?: string;
      message?: string;
    };
    message?: string;
  };

  if (body.error?.message) {
    return body.error.code
      ? `${body.error.message} (${body.error.code})`
      : body.error.message;
  }

  if (body.message) {
    return body.message;
  }

  return fallback;
}

export async function generateObjectWithNativeInference<TSchema extends z.ZodTypeAny>(params: {
  schema: TSchema;
  prompt: string;
}) {
  if (!inferenceClient) {
    throw new Error('Missing GitHub token. Set GITHUB_TOKEN or GITHUB_MODELS_TOKEN.');
  }

  let lastError: unknown;
  const chatModelIds = getChatModelIds();

  for (let index = 0; index < chatModelIds.length; index += 1) {
    const modelId = chatModelIds[index];

    try {
      const response = await inferenceClient.path('/chat/completions').post({
        body: buildChatCompletionBody(modelId, [
          {
            role: 'system',
            content:
              'You must return only valid JSON object output matching the requested schema. Do not include markdown fences.',
          },
          {
            role: 'user',
            content: params.prompt,
          },
        ]),
      });

      if (isUnexpected(response)) {
        const message = getUnexpectedErrorMessage(response);
        throw new Error(`Model ${modelId} failed (${response.status}): ${message}`);
      }

      const rawContent = response.body.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error(`Model ${modelId} returned empty content.`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new Error(`Model ${modelId} returned non-JSON content.`);
      }

      const object = params.schema.parse(parsed);
      return { object, modelId };
    } catch (error) {
      lastError = error;
      const shouldRetry =
        index < chatModelIds.length - 1 && isModelNotFoundError(error);

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error(
    `No configured chat models are available. Tried: ${chatModelIds.join(', ')}`,
    { cause: lastError }
  );
}
