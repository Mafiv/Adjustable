import { requireSessionUser } from '@/lib/auth-session';
import { redirect } from 'next/navigation';
import AppNav from '@/app/components/AppNav';
import AppShell, { AppMain } from '@/app/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSessionUser();
  } catch {
    redirect('/sign-in');
  }

  return (
    <AppShell>
      <AppNav />
      <AppMain>{children}</AppMain>
    </AppShell>
  );
}
