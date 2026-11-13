import { FileDown, Phone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import type { Scan } from '@/api/types';
import { CopyButton } from '@/components/CopyButton';
import { PageHeader } from '@/components/PageHeader';
import { WithScan } from '@/components/WithScan';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Textarea } from '@/components/ui/Textarea';
import { buildDossierText, scriptValues, sortEntities } from '@/lib/dossier';
import { displayValue, formatDateTime, formatTime, shortHash } from '@/lib/format';

function Summary({ scan, id }: { scan: Scan; id: string }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const entities = sortEntities(scan.confirmedEntities ?? []);
  const level = scan.result?.riskLevel ?? 'cannot_verify';

  const [summary, setSummary] = useState(() =>
    t('dossier.summaryTemplate', {
      kind: t(`kindsInline.${scan.kind}`),
      date: formatDateTime(scan.createdAt, language),
      level: t(`risk.label.${level}`),
    }),
  );

  const script = t(
    'dossier.script',
    scriptValues(entities, (value) => displayValue(value, language), t('dossier.notAvailable')),
  );

  const text = buildDossierText({
    title: t('dossier.title'),
    disclaimer: t('dossier.disclaimer'),
    summaryTitle: t('dossier.summaryTitle'),
    summary,
    detailsTitle: t('dossier.detailsTitle'),
    details: entities.map((entity) => ({
      label: t(`fields.${entity.type}`),
      value: displayValue(entity.value, language),
    })),
    evidenceTitle: t('dossier.evidenceTitle'),
    evidence: scan.evidence,
    scriptTitle: t('dossier.scriptTitle'),
    script,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader backTo={`/app/scan/${id}/details`} title={t('dossier.title')}>
        <p className="rounded-lg bg-chip px-3 py-2 text-sm">{t('dossier.disclaimer')}</p>
      </PageHeader>

      <section aria-labelledby="summary-title" className="flex flex-col gap-2">
        <h2 id="summary-title" className="text-lg font-extrabold">
          {t('dossier.summaryTitle')}
        </h2>
        <Textarea
          label={t('dossier.summaryLabel')}
          value={summary}
          maxLength={1000}
          onChange={(event) => setSummary(event.target.value)}
        />
      </section>

      <section aria-labelledby="details-title" className="flex flex-col gap-2">
        <h2 id="details-title" className="text-lg font-extrabold">
          {t('dossier.detailsTitle')}
        </h2>
        {entities.length === 0 ? (
          <p className="text-muted">{t('dossier.noDetails')}</p>
        ) : (
          <dl className="rounded-card border border-border bg-surface px-4">
            {entities.map((entity) => (
              <div
                key={entity.type}
                className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0"
              >
                <dt className="text-xs text-muted">{t(`fields.${entity.type}`)}</dt>
                <dd className="font-mono text-sm break-all">
                  {displayValue(entity.value, language)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="evidence-title" className="flex flex-col gap-2">
        <h2 id="evidence-title" className="text-lg font-extrabold">
          {t('dossier.evidenceTitle')}
        </h2>
        <p className="text-sm text-muted">{t('dossier.evidenceHint')}</p>
        <ul className="flex flex-col gap-3">
          {scan.evidence.map((item) => (
            <li
              key={item.sha256}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3"
            >
              <span className="font-semibold break-all">{item.name}</span>
              <span className="text-xs text-muted">
                SHA-256: <code className="font-mono break-all">{shortHash(item.sha256)}</code>
              </span>
              <span className="text-xs text-muted">
                {t('dossier.capturedAt', { time: formatDateTime(item.capturedAt, language) })}
              </span>
              <div>
                <CopyButton text={item.sha256} label={t('dossier.copyHash')} variant="ghost" />
              </div>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
          {t('dossier.keepOriginals')}
        </p>
      </section>

      <section aria-labelledby="script-title" className="flex flex-col gap-2">
        <h2 id="script-title" className="text-lg font-extrabold">
          {t('dossier.scriptTitle')}
        </h2>
        <p className="text-sm text-muted">{t('dossier.scriptHint')}</p>
        <blockquote className="rounded-card border-l-4 border-primary bg-surface p-4">
          {script}
        </blockquote>
        <div>
          <CopyButton text={script} label={t('dossier.copyScript')} />
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <CopyButton text={text} label={t('dossier.copyAll')} />
        <Button variant="outline" disabled>
          <FileDown className="size-5" aria-hidden="true" />
          {t('dossier.pdfSoon')}
        </Button>
        <a
          href="tel:1930"
          className={buttonVariants({ variant: 'danger', size: 'lg', block: true })}
        >
          <Phone className="size-5" aria-hidden="true" />
          {t('emergency.call')}
        </a>
      </div>

      <p className="text-sm text-muted">
        {t('scan.deleteAt', { time: formatTime(scan.expiresAt, language) })}
      </p>
    </div>
  );
}

export default function Dossier() {
  return (
    <WithScan>
      {(scan, id) => {
        if (scan.status !== 'done') return <Navigate to={`/app/scan/${id}`} replace />;
        if (scan.confirmedEntities === null)
          return <Navigate to={`/app/scan/${id}/details`} replace />;
        return <Summary scan={scan} id={id} />;
      }}
    </WithScan>
  );
}
