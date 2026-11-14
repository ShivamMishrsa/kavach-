import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StateMessage } from '@/components/StateMessage';
import { Button } from '@/components/ui/button';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';

/** Last-resort screen for unexpected errors. Never shows technical details to the user. */
export default function RootError() {
  const { t } = useTranslation();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <StateMessage
        heading="h1"
        icon={TriangleAlert}
        title={t('error.title')}
        message={t('error.body')}
        action={<Button onClick={() => window.location.assign('/')}>{t('error.reload')}</Button>}
      />
      <EmergencyStrip />
    </main>
  );
}
