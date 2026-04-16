'use client';

import Link from 'next/link';

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--card-border)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <span
        style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', fontWeight: 600 }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.03em', color: accent ?? 'var(--text-strong)', lineHeight: 1, textAlign: 'left' }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{sub}</span>
      )}
    </div>
  );
}

export function QuickAction({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--card-bg)',
        borderRadius: '14px',
        border: '1px solid var(--card-border)',
        textDecoration: 'none',
        boxShadow: 'var(--card-shadow)',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--card-shadow-hover)';
        el.style.borderColor = 'var(--neutral-300)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--card-shadow)';
        el.style.borderColor = 'var(--card-border)';
        el.style.transform = 'translateY(0)';
      }}
    >
      <span
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'var(--chip-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand-600)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</p>
      </div>
    </Link>
  );
}
