import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isMockApi } from '@/api/client';

/** Shown for as long as results come from the mock instead of real detection. */
export function DemoBanner() {
  const { t } = useTranslation();
  if (!isMockApi) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2 text-xs font-semibold text-warn"
    >
      <FlaskConical className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <span>{t('common.demoBanner')}</span>
    </p>
  );
}
