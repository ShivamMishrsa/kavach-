import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StateMessage } from '@/components/StateMessage';
import { buttonVariants } from '@/components/ui/button-variants';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <StateMessage
        heading="h1"
        icon={SearchX}
        title={t('notFound.title')}
        message={t('notFound.body')}
        action={
          <Link to="/" className={buttonVariants()}>
            {t('notFound.home')}
          </Link>
        }
      />
      <EmergencyStrip />
    </main>
  );
}
