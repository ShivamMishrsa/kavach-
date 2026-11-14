import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useInstall } from '@/pwa/install';

/** Add Kavach to the home screen: a button where the browser allows it, words where it does not. */
export function InstallPanel() {
  const { t } = useTranslation();
  const { state, install } = useInstall();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">{t('install.hint')}</p>
      {state === 'installed' && <p className="font-semibold">{t('install.done')}</p>}
      {state === 'available' && (
        <div>
          <Button onClick={() => void install()}>
            <Download className="size-5" aria-hidden="true" />
            {t('install.button')}
          </Button>
        </div>
      )}
      {state === 'ios' && <p className="font-semibold">{t('install.ios')}</p>}
      {state === 'other' && <p className="text-sm text-muted">{t('install.other')}</p>}
    </div>
  );
}
