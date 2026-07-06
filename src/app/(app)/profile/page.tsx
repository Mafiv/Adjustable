import { getProfile, saveProfile } from '@/app/actions/vault';
import ProfileClient from './ProfileClient';
import { LANGUAGE_PROFICIENCY_LEVELS } from '@/types/profile';

type ActionState = { status: 'idle' | 'success' | 'error'; message?: string };

async function saveProfileAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  'use server';
  try {
    const education: Array<{
      degree: string;
      institution: string;
      startDate: string;
      endDate: string;
      location: string;
      honors: string;
      coursework: string;
    }> = [];
    let i = 0;
    while (fd.has(`edu_deg_${i}`)) {
      const degree = String(fd.get(`edu_deg_${i}`) ?? '').trim();
      const institution = String(fd.get(`edu_inst_${i}`) ?? '').trim();
      const startDate = String(fd.get(`edu_start_${i}`) ?? '').trim();
      const endDate = String(fd.get(`edu_end_${i}`) ?? '').trim();
      const location = String(fd.get(`edu_loc_${i}`) ?? '').trim();
      const honors = String(fd.get(`edu_hon_${i}`) ?? '').trim();
      const coursework = String(fd.get(`edu_course_${i}`) ?? '').trim();

      if (degree || institution || startDate || endDate || location || honors || coursework) {
        education.push({ degree, institution, startDate, endDate, location, honors, coursework });
      }
      i++;
    }

    const languages: Array<{ name: string; proficiency: '' | (typeof LANGUAGE_PROFICIENCY_LEVELS)[number] }> = [];
    let j = 0;
    while (fd.has(`lang_name_${j}`)) {
      const name = String(fd.get(`lang_name_${j}`) ?? '').trim();
      const proficiencyRaw = String(fd.get(`lang_prof_${j}`) ?? '').trim();
      const proficiency = (LANGUAGE_PROFICIENCY_LEVELS as readonly string[]).includes(proficiencyRaw)
        ? (proficiencyRaw as (typeof LANGUAGE_PROFICIENCY_LEVELS)[number])
        : ('' as const);

      if (name) {
        languages.push({ name, proficiency });
      }
      j++;
    }

    await saveProfile({
      name: fd.get('name') ?? '',
      title: fd.get('title') ?? '',
      email: fd.get('email') ?? '',
      phone: fd.get('phone') ?? '',
      location: fd.get('location') ?? '',
      linkedin: fd.get('linkedin') ?? '',
      github: fd.get('github') ?? '',
      portfolio: fd.get('portfolio') ?? '',
      summary: fd.get('summary') ?? '',
      languages,
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
