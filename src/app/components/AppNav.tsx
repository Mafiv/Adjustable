'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useSidebar, useTheme } from './AppShell';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    href: '/vault',
    label: 'Vault',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    href: '/ingest',
    label: 'Ingest',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
      </svg>
    ),
  },
  {
    href: '/generate',
    label: 'Generate',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    href: '/exports',
    label: 'Exports',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

/* Chevron icons for the toggle */
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
    </svg>
  );
}

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="app-mobile-topbar">
        <button
          type="button"
          className="app-mobile-trigger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="app-mobile-brand">Adjustable</div>
      </header>

      {/* Mobile backdrop */}
      <div
        className={`app-sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>

        {/* Collapsed Logo */}
        {collapsed && (
          <div className="app-sidebar-logo-wrap">
            <div className="app-sidebar-logo-mark">
              A
            </div>
          </div>
        )}

        {/* Header — hidden when collapsed */}
        <div className="app-sidebar-header">
          <p className="app-sidebar-eyebrow">Workspace</p>
          <h2 className="app-sidebar-title">Adjustable</h2>
          <p className="app-sidebar-subtitle">Portfolio Vault</p>
        </div>

        {/* Nav links */}
        <nav className="app-sidebar-nav" aria-label="Main navigation">
          {!collapsed && (
            <p className="app-sidebar-section-label">Build</p>
          )}
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-sidebar-link ${isActive ? 'active' : ''}`}
                onClick={closeMobile}
                title={collapsed ? item.label : undefined}
              >
                <span className="app-sidebar-link-icon">{item.icon}</span>
                <span className="app-sidebar-link-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="app-sidebar-footer">
          <button
            type="button"
            onClick={toggleTheme}
            className="app-sidebar-action"
            title={collapsed ? 'Toggle theme' : undefined}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span className="app-sidebar-link-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            onClick={() => void authClient.signOut()}
            className="app-sidebar-signout"
            title={collapsed ? 'Sign out' : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span className="app-sidebar-link-label">Sign out</span>
          </button>
        </div>

        {/* Desktop collapse toggle — pinned to the right edge of the sidebar */}
        <button
          type="button"
          className="app-sidebar-collapse-btn"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </aside>
    </>
  );
}
