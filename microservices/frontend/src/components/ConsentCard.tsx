import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConsent } from '@/consent/ConsentProvider';
import { Button } from '@/components/ui/button';

/**
 * Plain-language consent shown before the first upload. Nothing can be sent until it is accepted,
 * and it can be withdrawn later in Settings.
 */
export function ConsentCard() {
  const { t } = useTranslation();
  const { granted, grant } = useConsent();
  if (granted) return null;

  const points = [t('consent.point1'), t('consent.point2'), t('consent.point3')];
  return (
    <section
      aria-labelledby="consent-title"
      className="flex flex-col gap-3 rounded-card border-2 border-primary bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
        <h2 id="consent-title" className="text-lg font-extrabold">
          {t('consent.title')}
        </h2>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t('consent.withdrawHint')}</p>
      <Button size="lg" block onClick={grant}>
        {t('consent.agree')}
      </Button>
    </section>
  );
}
