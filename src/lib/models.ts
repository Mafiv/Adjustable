import { createOpenAI } from '@ai-sdk/openai';

const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_MODELS_TOKEN;

const githubModels = createOpenAI({
  baseURL: 'https://models.github.ai/inference',
  apiKey: githubToken,
});

const openAIModels = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

const providerPreference =
  (
    process.env.AI_PROVIDER ??
    (process.env.OPENAI_API_KEY
      ? 'openai'
      : githubToken
        ? 'github'
        : 'openai')
  ).toLowerCase();

const provider = providerPreference === 'openai' ? openAIModels : githubModels;

export const embeddingModel = provider.embedding(
  process.env.AI_EMBEDDING_MODEL ?? process.env.GITHUB_EMBEDDING_MODEL ?? 'text-embedding-3-small'
);