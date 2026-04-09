import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function requireSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  return session.user;
}
