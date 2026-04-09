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
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e7e5e4',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 1px 4px rgba(28,25,23,0.05)',
      }}
    >
      <span
        style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e', fontWeight: 600 }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.03em', color: accent ?? '#1c1917', lineHeight: 1 }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '13px', color: '#78716c' }}>{sub}</span>
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
        gap: '14px',
        padding: '18px 20px',
        background: 'white',
        borderRadius: '14px',
        border: '1px solid #e7e5e4',
        textDecoration: 'none',
        boxShadow: '0 1px 4px rgba(28,25,23,0.05)',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 6px 24px rgba(28,25,23,0.1)';
        el.style.borderColor = '#d6d3d1';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 1px 4px rgba(28,25,23,0.05)';
        el.style.borderColor = '#e7e5e4';
        el.style.transform = 'translateY(0)';
      }}
    >
      <span
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: '#f2ebe0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#b87a38',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1c1917' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#78716c', lineHeight: 1.4 }}>{description}</p>
      </div>
    </Link>
  );
}
