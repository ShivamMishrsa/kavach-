import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  BAR_KEYS,
  RISK_BAR_INDEX,
  RISK_BG,
  RISK_BORDER,
  RISK_SOFT_BG,
  type RiskLevel,
} from './risk';

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-block rounded-full px-3 py-1 text-sm font-extrabold text-on-risk',
        RISK_BG[level],
      )}
    >
      {t(`risk.label.${level}`)}
    </span>
  );
}

export function LevelBar({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  const active = RISK_BAR_INDEX[level];
  return (
    <ol className="flex gap-1.5" aria-label={t(`risk.label.${level}`)}>
      {BAR_KEYS.map((key, index) => {
        const on = active !== null && index === active;
        return (
          <li
            key={key}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'flex-1 rounded-lg px-1 py-1.5 text-center text-xs font-bold',
              on ? cn(RISK_BG[level], 'text-on-risk') : 'bg-border text-muted',
            )}
          >
            {t(`risk.bar.${key}`)}
          </li>
        );
      })}
    </ol>
  );
}

export function ReasonList({ reasons }: { reasons: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {reasons.map((reason) => (
        <li key={reason} className="flex gap-2.5 text-[0.95rem]">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border border-danger bg-danger-bg text-xs font-extrabold text-danger"
          >
            !
          </span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}

interface RiskCardProps {
  level: RiskLevel;
  reasons: string[];
  onWrongResult?: () => void;
}

/** Shows a risk level with reasons and the mandatory disclaimer. Never an absolute verdict. */
export function RiskCard({ level, reasons, onWrongResult }: RiskCardProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3" aria-labelledby="risk-title">
      <div className={cn('rounded-card border-2 p-4', RISK_SOFT_BG[level], RISK_BORDER[level])}>
        <RiskBadge level={level} />
        <h2 id="risk-title" className="mt-2 text-xl leading-snug font-extrabold">
          {t(`risk.title.${level}`)}
        </h2>
        <p className="mt-1">{t(`risk.message.${level}`)}</p>
      </div>
      <LevelBar level={level} />
      {reasons.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-4">
          <h3 className="mb-2 font-bold">{t('risk.why')}</h3>
          <ReasonList reasons={reasons} />
        </div>
      )}
      <p className="text-center text-xs text-muted">{t('risk.disclaimer')}</p>
      {onWrongResult && (
        <button
          type="button"
          onClick={onWrongResult}
          className="min-h-11 self-center text-sm font-semibold text-primary underline"
        >
          {t('risk.wrongResult')}
        </button>
      )}
    </section>
  );
}
