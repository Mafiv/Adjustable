'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* ─── Context ─────────────────────────────────────────────────────────── */

type SidebarCtx = {
  collapsed: boolean;
  toggle: () => void;
};

type Theme = 'light' | 'dark';
type ThemeCtx = {
  theme: Theme;
  toggleTheme: () => void;
};

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });
export const useSidebar = () => useContext(SidebarContext);
const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

const SIDEBAR_STORAGE_KEY = 'adjustable-sidebar-collapsed';
const THEME_STORAGE_KEY = 'adjustable-theme';

/* ─── Shell wrapper ───────────────────────────────────────────────────── */

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  // Persist & restore
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <SidebarContext.Provider value={{ collapsed, toggle }}>
        <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`} style={{ display: 'flex', minHeight: '100vh' }}>
          {children}
        </div>
      </SidebarContext.Provider>
    </ThemeContext.Provider>
  );
}

/* ─── Main area wrapper ───────────────────────────────────────────────── */

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
