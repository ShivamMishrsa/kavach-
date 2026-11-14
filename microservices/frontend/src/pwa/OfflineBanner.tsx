import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isMockApi } from '@/api/client';
import { useOnline } from './useOnline';

/** Shown on every screen while there is no connection, and gone the moment it is back. */
export function OfflineBanner() {
  const { t } = useTranslation();
  if (useOnline()) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm font-semibold text-warn"
    >
      <WifiOff className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <span>{t(isMockApi ? 'offline.bannerDemo' : 'offline.banner')}</span>
    </p>
  );
}
