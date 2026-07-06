export const SOCIAL_PROVIDER_IDS = ['github', 'google', 'discord'] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export function getEnabledSocialProviders(): SocialProviderId[] {
  const providers: SocialProviderId[] = [];

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push('github');
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push('google');
  }
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.push('discord');
  }

  return providers;
}
