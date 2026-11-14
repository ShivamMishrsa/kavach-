import { Mail } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { isMockApi } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail } from '@/auth/session';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { errorKey } from '@/lib/errors';

/**
 * Log in and sign up share one screen: passwordless email link. With the real backend the link
 * is emailed; in the demo nothing is sent and a button simulates opening it.
 */
export function AuthEmail({ mode }: { mode: 'login' | 'signup' }) {
  const { t } = useTranslation();
  const { signIn, requestLink, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateEmail(email)) {
      setError(t('auth.emailError'));
      return;
    }
    setError(undefined);
    if (!isMockApi) {
      setPending(true);
      try {
        await requestLink(email);
      } catch (failure) {
        setError(t(errorKey(failure)));
        return;
      } finally {
        setPending(false);
      }
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-5 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-chip text-primary">
            <Mail className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-extrabold">{t('auth.checkTitle')}</h1>
          <p>{t('auth.checkBody', { email: email.trim() })}</p>
          <p className="text-sm text-muted">{t(isMockApi ? 'auth.demoNote' : 'auth.linkNote')}</p>
        </div>
        {isMockApi && (
          <Button size="lg" block onClick={() => navigate(signIn(email))}>
            {t('auth.continueDemo')}
          </Button>
        )}
        <Button variant="ghost" block onClick={() => setSent(false)}>
          {t('auth.useOtherEmail')}
        </Button>
      </div>
    );
  }

  const isLogin = mode === 'login';
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        backTo="/"
        title={isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
        subtitle={isLogin ? undefined : t('auth.signupBenefit')}
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('auth.emailLabel')}
          hint={t('auth.emailHint')}
          error={error}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
        />
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? t('common.loading') : t('auth.sendLink')}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
        <Link to={isLogin ? '/signup' : '/login'} className="font-bold text-primary underline">
          {isLogin ? t('welcome.signup') : t('welcome.login')}
        </Link>
      </p>
      <Button variant="ghost" block onClick={() => navigate(continueAsGuest())}>
        {t('welcome.guest')}
      </Button>
    </div>
  );
}
