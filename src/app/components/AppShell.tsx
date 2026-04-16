'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/* ── Combined sidebar + theme context ──────────────────────────── */
type Theme = 'light' | 'dark';

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggle: () => {},
  theme: 'light',
  toggleTheme: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/** @deprecated Use useSidebar instead */
export function useTheme() {
  const { theme, toggleTheme } = useContext(SidebarContext);
  return { theme, toggleTheme };
}

/* ── AppShell (root layout provider) ──────────────────────────── */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  /* Restore persisted preferences */
  useEffect(() => {
    const savedTheme = localStorage.getItem('adjustable-theme') as Theme | null;
    const savedCollapsed = localStorage.getItem('adjustable-sidebar-collapsed');
    const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';

    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    if (savedCollapsed === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('adjustable-sidebar-collapsed', String(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('adjustable-theme', next);
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, theme, toggleTheme }}>
      {children}
    </SidebarContext.Provider>
  );
}

/* ── Sub-layout components ─────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="app-shell-layout"
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-main-bg)' }}
    >
      {children}
    </div>
  );
}

export function AppMain({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="app-shell-main"
      style={{
        flex: 1,
        minHeight: '100vh',
        background: 'var(--app-main-bg)',
      }}
    >
      {children}
    </main>
  );
}
