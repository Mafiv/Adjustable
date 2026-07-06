'use client';

import { useActionState, useState } from 'react';
import type { ProfileFieldKey } from '@/lib/cv-profile';
import { LANGUAGE_PROFICIENCY_LEVELS, type EducationEntry, type LanguageEntry } from '@/types/profile';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string };
const init: ActionState = { status: 'idle' };

type Profile = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  languages: LanguageEntry[];
  education: EducationEntry[];
  completeness?: {
    missingCore: string[];
    missingOptional: string[];
    isCoreComplete: boolean;
  };
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

const emptyEducation = (): EducationEntry => ({
  degree: '',
  institution: '',
  startDate: '',
  endDate: '',
  location: '',
  honors: '',
  coursework: '',
});

const emptyLanguage = (): LanguageEntry => ({ name: '', proficiency: '' });

function MissingBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warn-text)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: '999px', padding: '1px 8px' }}>
      missing
    </span>
  );
}

function isFieldMissing(profile: Profile, key: ProfileFieldKey) {
  if (key === 'education') return profile.education.length === 0;
  if (key === 'languages') return profile.languages.length === 0;
  return !String(profile[key] ?? '').trim();
}

export default function ProfileClient({
  initial,
  saveAction,
}: {
  initial: Profile;
  saveAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, isPending] = useActionState(saveAction, init);
  const [edu, setEdu] = useState<EducationEntry[]>(
    initial.education.length > 0 ? initial.education : [emptyEducation()]
  );
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    initial.languages.length > 0 ? initial.languages : [emptyLanguage()]
  );

  const addEdu = () => setEdu([...edu, emptyEducation()]);
  const removeEdu = (idx: number) => setEdu(edu.filter((_, i) => i !== idx));
  const addLanguage = () => setLanguages([...languages, emptyLanguage()]);
  const removeLanguage = (idx: number) => setLanguages(languages.filter((_, i) => i !== idx));

  const label = (key: ProfileFieldKey, text: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {text}
      <MissingBadge show={isFieldMissing(initial, key)} />
    </span>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.35em', color: 'var(--text-subtle)', margin: '0 0 6px' }}>Settings</p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-strong)', margin: 0 }}>Your Profile</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          This information appears in the PDF header, education, and languages sections.
        </p>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label style={field}>{label('name', 'Full Name')} <input name="name" defaultValue={initial.name} placeholder="Jane Doe" style={input} maxLength={120} /></label>
            <label style={field}>Job Title / Role <input name="title" defaultValue={initial.title} placeholder="Full-Stack Developer" style={input} maxLength={120} /></label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <label style={field}>{label('email', 'Email')} <input name="email" type="email" defaultValue={initial.email} placeholder="jane@email.com" style={input} maxLength={200} /></label>
            <label style={field}>{label('phone', 'Phone')} <input name="phone" defaultValue={initial.phone} placeholder="+1 234 567 890" style={input} maxLength={60} /></label>
          </div>

          <label style={field}>{label('location', 'Location')} <input name="location" defaultValue={initial.location} placeholder="City, Country" style={input} maxLength={120} /></label>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: 0 }}>Social &amp; Links</p>
            <label style={field}>{label('linkedin', 'LinkedIn URL')} <input name="linkedin" defaultValue={initial.linkedin} placeholder="linkedin.com/in/janedoe" style={input} maxLength={300} /></label>
            <label style={field}>{label('github', 'GitHub URL')} <input name="github" defaultValue={initial.github} placeholder="github.com/janedoe" style={input} maxLength={300} /></label>
            <label style={field}>{label('portfolio', 'Portfolio / Website')} <input name="portfolio" defaultValue={initial.portfolio} placeholder="janedoe.dev" style={input} maxLength={300} /></label>
          </div>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                Education
                <MissingBadge show={isFieldMissing(initial, 'education')} />
              </p>
              <button type="button" onClick={addEdu} style={{ fontSize: '12px', color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add Education</button>
            </div>
            {edu.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--edu-row-bg)', padding: '10px', borderRadius: '8px' }}>
                <label style={field}>Degree <input name={`edu_deg_${i}`} defaultValue={item.degree} placeholder="B.Sc. Computer Science" style={input} /></label>
                <label style={field}>Institution <input name={`edu_inst_${i}`} defaultValue={item.institution} placeholder="Stanford University" style={input} /></label>
                <label style={field}>Start date <input name={`edu_start_${i}`} defaultValue={item.startDate} placeholder="2018" style={input} /></label>
                <label style={field}>End date <input name={`edu_end_${i}`} defaultValue={item.endDate} placeholder="2022" style={input} /></label>
                <label style={field}>Location <input name={`edu_loc_${i}`} defaultValue={item.location ?? ''} placeholder="City, Country" style={input} /></label>
                <label style={field}>Honors <input name={`edu_hon_${i}`} defaultValue={item.honors ?? ''} placeholder="GPA 3.8, Dean's List" style={input} /></label>
                <label style={{ ...field, gridColumn: '1 / -1' }}>Relevant coursework <input name={`edu_course_${i}`} defaultValue={item.coursework ?? ''} placeholder="Algorithms, Databases, Machine Learning" style={input} /></label>
                <button type="button" onClick={() => removeEdu(i)} style={{ gridColumn: '1 / -1', justifySelf: 'end', padding: '8px', color: 'var(--danger-text)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px' }}>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: '0 0 10px' }}>Professional Summary</p>
            <label style={field}>{label('summary', 'Bio')}
              <textarea name="summary" defaultValue={initial.summary} rows={4} placeholder="2–4 sentences..." style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} maxLength={1000} />
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--section-divider)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-subtle)', margin: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                {label('languages', 'Languages')}
              </p>
              <button type="button" onClick={addLanguage} style={{ fontSize: '12px', color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add Language</button>
            </div>
            {languages.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <label style={field}>Language <input name={`lang_name_${i}`} defaultValue={item.name} placeholder="English" style={input} maxLength={80} /></label>
                <label style={field}>
                  Proficiency
                  <select name={`lang_prof_${i}`} defaultValue={item.proficiency} style={input}>
                    <option value="">Select level</option>
                    {LANGUAGE_PROFICIENCY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => removeLanguage(i)} style={{ padding: '9px 12px', color: 'var(--danger-text)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
              </div>
            ))}
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
