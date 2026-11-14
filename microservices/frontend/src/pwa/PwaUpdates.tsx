import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { registerServiceWorker } from './register';

/** Starts the service worker and, when a new version is ready, asks before reloading. */
export function PwaUpdates() {
  const { t } = useTranslation();

  useEffect(() => {
    registerServiceWorker((apply) =>
      toast(t('pwa.updateReady'), {
        duration: Infinity,
        action: { label: t('pwa.reload'), onClick: apply },
      }),
    );
    // Once per page load: the text of the message is read when the update is found.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
