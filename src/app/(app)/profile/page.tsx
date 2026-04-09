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
      education.push({
        degree:      fd.get(`edu_deg_${i}`)      as string ?? '',
        institution: fd.get(`edu_inst_${i}`)     as string ?? '',
        year:        fd.get(`edu_year_${i}`)     as string ?? '',
      });
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
