import { createAuthClient } from 'better-auth/react';

function resolveAuthBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000'
  );
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
});
