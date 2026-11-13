import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StateMessage } from '@/components/StateMessage';
import { Button } from '@/components/ui/button';

/** Last-resort screen for unexpected errors. Never shows technical details to the user. */
export default function RootError() {
  const { t } = useTranslation();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <StateMessage
        icon={TriangleAlert}
        title={t('error.title')}
        message={t('error.body')}
        action={<Button onClick={() => window.location.assign('/')}>{t('error.reload')}</Button>}
      />
    </main>
  );
}
