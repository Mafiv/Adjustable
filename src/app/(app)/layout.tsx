import { requireSessionUser } from '@/lib/auth-session';
import { redirect } from 'next/navigation';
import AppNav from '@/app/components/AppNav';

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AppNav />
      <main
        style={{
          flex: 1,
          marginLeft: '220px',
          minHeight: '100vh',
          background: '#faf6f0',
        }}
      >
        {children}
      </main>
    </div>
  );
}
