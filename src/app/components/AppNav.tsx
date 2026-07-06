'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useSidebar } from './AppShell';

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        description: 'Overview & activity',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        href: '/vault',
        label: 'Vault',
        description: 'Experience entries',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        ),
      },
      {
        href: '/ingest',
        label: 'Ingest',
        description: 'Upload & shred CV',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Output',
    items: [
      {
        href: '/generate',
        label: 'Generate',
        description: 'Tailor to a job',
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
        description: 'PDFs & history',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        href: '/profile',
        label: 'Profile',
        description: 'Contact & education',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        ),
      },
    ],
  },
];

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

function getInitials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isActivePath(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { collapsed, toggle, theme, toggleTheme } = useSidebar();
  const { data: session } = authClient.useSession();

  const userName = session?.user?.name?.trim() || 'Your account';
  const userEmail = session?.user?.email?.trim() || '';
  const userInitials = getInitials(session?.user?.name, session?.user?.email);

  const closeMobile = () => setMobileOpen(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    closeMobile();

    try {
      const result = await authClient.signOut();
      if (result.error) {
        console.error('Sign out failed:', result.error.message);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      window.location.href = '/sign-in';
    }
  }

  return (
    <>
      <header className="app-mobile-topbar">
        <button
          type="button"
          className="app-mobile-trigger"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="app-mobile-brand">
          <span className="app-mobile-brand-mark">A</span>
          Adjustable
        </div>
      </header>

      <div
        className={`app-sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="app-sidebar-glow" aria-hidden="true" />

        <div className="app-sidebar-brand">
          <div className="app-sidebar-brand-row">
            <div className="app-sidebar-logo-mark" aria-hidden="true">A</div>
            <div className="app-sidebar-brand-copy">
              <p className="app-sidebar-brand-name">Adjustable</p>
              <p className="app-sidebar-brand-tag">Portfolio Vault</p>
            </div>
          </div>
          {!collapsed && (
            <Link href="/generate" className="app-sidebar-cta" onClick={closeMobile}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              New generation
            </Link>
          )}
        </div>

        <nav className="app-sidebar-nav" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="app-sidebar-section">
              {!collapsed && <p className="app-sidebar-section-label">{section.label}</p>}
              <div className="app-sidebar-section-items">
                {section.items.map((item) => {
                  const isActive = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`app-sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={closeMobile}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="app-sidebar-link-icon">{item.icon}</span>
                      <span className="app-sidebar-link-copy">
                        <span className="app-sidebar-link-label">{item.label}</span>
                        {!collapsed && item.description && (
                          <span className="app-sidebar-link-desc">{item.description}</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <div className="app-sidebar-avatar" aria-hidden="true">{userInitials}</div>
            <div className="app-sidebar-user-copy">
              <p className="app-sidebar-user-name">{userName}</p>
              {userEmail && <p className="app-sidebar-user-email">{userEmail}</p>}
            </div>
          </div>

          <div className="app-sidebar-footer-actions">
            <button
              type="button"
              onClick={toggleTheme}
              className="app-sidebar-icon-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="app-sidebar-signout"
              disabled={signingOut}
              title={collapsed ? 'Sign out' : undefined}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              <span className="app-sidebar-link-label">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>

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
