import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { usePending } from '@/offline/PendingProvider';

/** Checks waiting for a connection: what they are, when they were saved, and a way out. */
export function PendingChecks() {
  const { t, i18n } = useTranslation();
  const { checks, sendNow, remove } = usePending();
  if (checks.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-title"
      className="flex flex-col gap-2 rounded-card border-2 border-border bg-surface p-4"
    >
      <h2 id="pending-title" className="flex items-center gap-2 text-lg font-extrabold">
        <Clock className="size-5" aria-hidden="true" />
        {t('pending.title')}
      </h2>
      <p className="text-sm text-muted">{t('pending.note')}</p>
      <ul className="flex flex-col gap-2">
        {checks.map((check) => (
          <li key={check.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="font-semibold">{t(`kinds.${check.input.kind}`)}</span>
              <span className="text-xs text-muted">
                {t('pending.savedAt', {
                  time: formatTime(new Date(check.savedAt).toISOString(), i18n.language),
                })}
              </span>
            </span>
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => void sendNow(check.id)}>
                {t('pending.sendNow')}
              </Button>
              <Button variant="ghost" onClick={() => void remove(check.id)}>
                {t('pending.remove')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
