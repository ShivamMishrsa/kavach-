import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StateMessage } from '@/components/StateMessage';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';

/** Shown instead of the whole site while it is being updated (set VITE_MAINTENANCE=true). */
export default function Maintenance() {
  const { t } = useTranslation();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <StateMessage
        heading="h1"
        icon={Wrench}
        title={t('maintenance.title')}
        message={t('maintenance.body')}
      />
      <EmergencyStrip />
    </main>
  );
}
