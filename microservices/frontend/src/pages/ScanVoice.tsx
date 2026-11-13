import { Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StateMessage } from '@/components/StateMessage';
import { buttonVariants } from '@/components/ui/button-variants';

/** Voice checks are not available yet. We say so instead of pretending. */
export default function ScanVoice() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader backTo="/app" title={t('voice.title')} />
      <StateMessage
        icon={Mic}
        title={t('voice.soonTitle')}
        message={t('voice.soonBody')}
        action={
          <Link to="/app/scan/notice" className={buttonVariants()}>
            {t('voice.useText')}
          </Link>
        }
      />
    </div>
  );
}
