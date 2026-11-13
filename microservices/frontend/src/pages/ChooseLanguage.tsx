import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { LanguagePicker } from '@/components/LanguagePicker';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

/** Shown once, right after sign up, log in or "continue without account". */
export default function ChooseLanguage() {
  const { t } = useTranslation();
  const { completeOnboarding } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('language.title')} />
      <LanguagePicker />
      <Button
        size="lg"
        block
        onClick={() => {
          completeOnboarding();
          navigate('/app');
        }}
      >
        {t('common.continue')}
      </Button>
    </div>
  );
}
