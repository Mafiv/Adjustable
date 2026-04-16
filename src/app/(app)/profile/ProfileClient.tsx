'use client';

import { useActionState, useState } from 'react';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string };
const init: ActionState = { status: 'idle' };

type Education = { degree: string; institution: string; year: string };
type Profile = {
  name: string; title: string; email: string; phone: string;
  location: string; linkedin: string; portfolio: string; summary: string;
  education: Education[];
};

const field: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '5px',
  fontSize: '13px', fontWeight: 600, color: 'var(--label-color)',
};
const input: React.CSSProperties = {
  borderRadius: '10px', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', padding: '9px 14px',
  fontSize: '13px', color: 'var(--input-text)', outline: 'none', width: '100%',
};

export default function ProfileClient({
  initial,
  saveAction,
}: {
  initial: Profile;
  saveAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, isPending] = useActionState(saveAction, init);
  const [edu, setEdu] = useState<Education[]>(initial.education.length > 0 ? initial.education : [{ degree: '', institution: '', year: '' }]);

  const addEdu = () => setEdu([...edu, { degree: '', institution: '', year: '' }]);
  const removeEdu = (idx: number) => setEdu(edu.filter((_, i) => i !== idx));

  return (
    <div style={{ padding: '24px 32px', maxWidth: '700px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: 'var(--text-subtle)', margin: '0 0 6px' }}>Settings</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: 0 }}>Your Profile</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          This information appears in the PDF header and education section of every exported resume.
        </p>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label style={field}>Full Name <input name="name" defaultValue={initial.name} placeholder="Jane Doe" style={input} maxLength={120} /></label>
            <label style={field}>Job Title / Role <input name="title" defaultValue={initial.title} placeholder="Full-Stack Developer" style={input} maxLength={120} /></label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label style={field}>Email <input name="email" type="email" defaultValue={initial.email} placeholder="jane@email.com" style={input} maxLength={200} /></label>
            <label style={field}>Phone <input name="phone" defaultValue={initial.phone} placeholder="+1 234 567 890" style={input} maxLength={60} /></label>
          </div>

          <label style={field}>Location <input name="location" defaultValue={initial.location} placeholder="City, Country" style={input} maxLength={120} /></label>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: 0 }}>Social &amp; Links</p>
            <label style={field}>LinkedIn URL <input name="linkedin" defaultValue={initial.linkedin} placeholder="linkedin.com/in/janedoe" style={input} maxLength={300} /></label>
            <label style={field}>Portfolio / Website <input name="portfolio" defaultValue={initial.portfolio} placeholder="janedoe.dev" style={input} maxLength={300} /></label>
          </div>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: 0 }}>Education</p>
              <button type="button" onClick={addEdu} style={{ fontSize: '12px', color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add Education</button>
            </div>
            {edu.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.6fr 40px', gap: '10px', alignItems: 'flex-end', background: 'var(--edu-row-bg)', padding: '10px', borderRadius: '8px' }}>
                <label style={field}>Degree <input name={`edu_deg_${i}`} defaultValue={item.degree} placeholder="B.Sc. Computer Science" style={input} /></label>
                <label style={field}>Institution <input name={`edu_inst_${i}`} defaultValue={item.institution} placeholder="Stanford University" style={input} /></label>
                <label style={field}>Year <input name={`edu_year_${i}`} defaultValue={item.year} placeholder="2021" style={input} /></label>
                <button type="button" onClick={() => removeEdu(i)} style={{ padding: '8px', color: 'var(--danger-text)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: '0 0 10px' }}>Professional Summary</p>
            <label style={field}>Bio (used as fallback summary in PDF)
              <textarea name="summary" defaultValue={initial.summary} rows={4} placeholder="2–4 sentences..." style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} maxLength={1000} />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
            <button style={{ padding: '10px 24px', borderRadius: '999px', background: 'var(--action-btn-bg)', color: 'var(--action-btn-text)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1 }} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save profile'}
            </button>
            {state.status === 'success' && <span style={{ fontSize: '13px', color: 'var(--success-text)', fontWeight: 600 }}>✓ Saved</span>}
            {state.status === 'error' && <span style={{ fontSize: '13px', color: 'var(--danger-text)' }}>{state.message ?? 'Save failed'}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
