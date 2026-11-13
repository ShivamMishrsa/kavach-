import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Brand() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-xl font-extrabold">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      {t('app.name')}
    </span>
  );
}
