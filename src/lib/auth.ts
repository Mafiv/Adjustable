import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { nextCookies } from 'better-auth/next-js';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

function normalizeOrigin(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.FRONTEND_ORIGIN,
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '').split(','),
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://adjustable.vercel.app',
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeOrigin)
      .filter(Boolean)
  )
);

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment.');
}

const mongoClient = new MongoClient(MONGODB_URI);
const db = mongoClient.db(MONGODB_DB_NAME);

const socialProviders: Record<
  string,
  {
    clientId: string;
    clientSecret: string;
  }
> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  socialProviders.discord = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client: mongoClient,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  ...(Object.keys(socialProviders).length > 0
    ? { socialProviders }
    : {}),
  plugins: [nextCookies()],
});
