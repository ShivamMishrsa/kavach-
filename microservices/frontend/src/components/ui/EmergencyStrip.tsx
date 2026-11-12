import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** National cyber-fraud helpline strip. Always reachable from the main screens. */
export function EmergencyStrip() {
  const { t } = useTranslation();
  return (
    <a
      href="tel:1930"
      aria-label={t('emergency.call')}
      className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-danger-bg px-4 py-2.5 text-sm font-bold text-danger"
    >
      <span>{t('emergency.text')}</span>
      <Phone className="size-5 flex-none" aria-hidden="true" />
    </a>
  );
}
