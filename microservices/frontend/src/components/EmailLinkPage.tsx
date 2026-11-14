import { Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner, StateMessage } from '@/components/StateMessage';
import { buttonVariants } from '@/components/ui/button-variants';

type Mode = 'signIn' | 'confirmEmail';

/** The one attempt per kind of link for this page load. A link works once, so it is never sent twice. */
const attempts = new Map<Mode, Promise<string>>();

/**
 * Where an emailed link leads. The secret is in the part of the address after "#", so it never
 * reaches a server log. The page uses it once and removes it from the address bar.
 */
export function EmailLinkPage({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const { completeSignIn, confirmEmailChange } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const confirming = mode === 'confirmEmail';

  useEffect(() => {
    if (!attempts.has(mode)) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
      window.history.replaceState(null, '', window.location.pathname); // keep it out of the history
      const run = async (secret: string) => {
        if (!confirming) return completeSignIn(secret);
        await confirmEmailChange(secret);
        toast.success(t('auth.emailChanged'));
        return '/app/settings';
      };
      const attempt = token ? run(token) : Promise.reject(new Error('No link'));
      attempts.set(mode, attempt);
      const forget = () => attempts.delete(mode);
      attempt.then(forget, forget);
    }
    let active = true;
    attempts.get(mode)?.then(
      (destination) => active && navigate(destination, { replace: true }),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
    // Once per visit: signing in changes what completeSignIn is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!failed) return <Spinner label={t(confirming ? 'auth.confirmingEmail' : 'auth.verifying')} />;
  return (
    <StateMessage
      icon={Link2}
      title={t('auth.verifyFailedTitle')}
      message={t(confirming ? 'auth.confirmFailedBody' : 'auth.verifyFailedBody')}
      action={
        <Link to={confirming ? '/app/settings' : '/login'} className={buttonVariants()}>
          {t(confirming ? 'settings.title' : 'auth.newLink')}
        </Link>
      }
    />
  );
}
