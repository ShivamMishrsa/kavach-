import { FileSearch, Languages, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { signInAvailable } from '@/api/mode';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';

/** First screen. Guest mode is always offered so nobody in a hurry is forced to sign up. */
export default function Welcome() {
  const { t } = useTranslation();
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const points = [
    { icon: FileSearch, text: t('welcome.point1') },
    { icon: Languages, text: t('welcome.point2') },
    { icon: Trash2, text: t('welcome.point3') },
  ];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl leading-tight font-extrabold">{t('app.tagline')}</h1>
        <p className="text-lg text-muted">{t('welcome.subtitle')}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-chip text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Button size="lg" block onClick={() => navigate(continueAsGuest())}>
          {t('welcome.guest')}
        </Button>
        <p className="text-center text-sm text-muted">{t('welcome.guestHint')}</p>
      </div>

      {signInAvailable && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            {t('welcome.or')}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('welcome.login')}
            </Link>
            <Link to="/signup" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('welcome.signup')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
