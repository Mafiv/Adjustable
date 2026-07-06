import { AuthFormWithSearchParams } from '@/app/sign-in/AuthForm';
import { getEnabledSocialProviders } from '@/lib/auth-providers';

export default function SignInPage() {
  const socialProviders = getEnabledSocialProviders();

  return <AuthFormWithSearchParams socialProviders={socialProviders} />;
}
