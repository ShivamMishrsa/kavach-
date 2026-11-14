import { ExternalLink, Phone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  SENT_MONEY_KEY,
  SENT_MONEY_STEPS,
  parseChecked,
  toggleStep,
  type SentMoneyStep,
} from '@/lib/checklist';
import { readStorage, writeStorage } from '@/lib/storage';

/** First-hour checklist for someone who has already paid. Ticks are saved on this device only. */
export default function SentMoney() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [checked, setChecked] = useState<SentMoneyStep[]>(() =>
    parseChecked(readStorage(SENT_MONEY_KEY)),
  );

  function update(next: SentMoneyStep[]) {
    setChecked(next);
    writeStorage(SENT_MONEY_KEY, JSON.stringify(next));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        backTo={session ? '/app' : '/'}
        title={t('sentMoney.title')}
        subtitle={t('sentMoney.subtitle')}
      />

      <div className="flex flex-col gap-2">
        <a
          href="tel:1930"
          className={buttonVariants({ variant: 'danger', size: 'lg', block: true })}
        >
          <Phone className="size-5" aria-hidden="true" />
          {t('emergency.call')}
        </a>
        <a
          href="https://cybercrime.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'lg', block: true })}
        >
          <ExternalLink className="size-5" aria-hidden="true" />
          {t('sentMoney.portal')}
        </a>
      </div>

      <section aria-labelledby="checklist-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="checklist-title" className="text-lg font-extrabold">
            {t('sentMoney.checklist')}
          </h2>
          <p role="status" className="text-sm font-semibold text-muted">
            {t('sentMoney.progress', { done: checked.length, total: SENT_MONEY_STEPS.length })}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {SENT_MONEY_STEPS.map((step) => (
            <li key={step}>
              <label className="flex items-start gap-3 rounded-card border border-border bg-surface p-3">
                <input
                  type="checkbox"
                  checked={checked.includes(step)}
                  onChange={() => update(toggleStep(checked, step))}
                  className="mt-1 size-5 flex-none accent-primary"
                />
                <span className="flex flex-col">
                  <span className="font-bold">{t(`sentMoney.steps.${step}.title`)}</span>
                  <span className="text-sm text-muted">{t(`sentMoney.steps.${step}.detail`)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {checked.length > 0 && (
          <div>
            <Button variant="ghost" onClick={() => update([])}>
              {t('sentMoney.clear')}
            </Button>
          </div>
        )}
      </section>

      <Link
        to={session ? '/app/scan/notice' : '/start'}
        className={buttonVariants({ size: 'lg', block: true })}
      >
        {t('sentMoney.prepare')}
      </Link>
    </div>
  );
}
