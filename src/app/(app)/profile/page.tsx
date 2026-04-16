import { getProfile, saveProfile } from '@/app/actions/vault';
import ProfileClient from './ProfileClient';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string };

async function saveProfileAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  'use server';
  try {
    const education: Array<{ degree: string; institution: string; year: string }> = [];
    let i = 0;
    while (fd.has(`edu_deg_${i}`)) {
      const degreeRaw = fd.get(`edu_deg_${i}`);
      const institutionRaw = fd.get(`edu_inst_${i}`);
      const yearRaw = fd.get(`edu_year_${i}`);

      const degree = typeof degreeRaw === 'string' ? degreeRaw.trim() : '';
      const institution = typeof institutionRaw === 'string' ? institutionRaw.trim() : '';
      const year = typeof yearRaw === 'string' ? yearRaw.trim() : '';

      // Avoid persisting empty placeholder rows.
      if (degree || institution || year) {
        education.push({ degree, institution, year });
      }
      i++;
    }

    await saveProfile({
      name:      fd.get('name')      ?? '',
      title:     fd.get('title')     ?? '',
      email:     fd.get('email')     ?? '',
      phone:     fd.get('phone')     ?? '',
      location:  fd.get('location')  ?? '',
      linkedin:  fd.get('linkedin')  ?? '',
      portfolio: fd.get('portfolio') ?? '',
      summary:   fd.get('summary')   ?? '',
      education,
    });
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: (err as Error).message };
  }
}

export default async function ProfilePage() {
  const profile = await getProfile();
  return <ProfileClient initial={profile} saveAction={saveProfileAction} />;
}
