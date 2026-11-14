import { FlaskConical, Phone, Share2, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useDeleteScan } from '@/api/queries';
import type { Scan } from '@/api/types';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { PageHeader } from '@/components/PageHeader';
import { StateMessage } from '@/components/StateMessage';
import { WithScan } from '@/components/WithScan';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { RiskCard } from '@/components/ui/RiskCard';
import { Stepper } from '@/components/ui/Stepper';
import { formatTime } from '@/lib/format';
import { shareOrCopy } from '@/lib/share';

function Processing({ scan, id }: { scan: Scan; id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const del = useDeleteScan();
  const current = scan.stages.find((stage) => stage.status === 'current');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('scan.checking')} subtitle={t('scan.checkingHint')} />
      <Stepper
        steps={scan.stages.map((stage) => ({
          id: stage.id,
          label: t(`steps.${stage.id}`),
          status: stage.status,
        }))}
      />
      <p className="sr-only" aria-live="polite">
        {current ? t(`steps.${current.id}`) : ''}
      </p>
      <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">
        {t('scan.privacyNote')}
      </p>
      <Button
        variant="ghost"
        block
        onClick={async () => {
          await del.mutateAsync(id);
          navigate('/app');
        }}
      >
        {t('common.cancel')}
      </Button>
    </div>
  );
}

function Done({ scan, id }: { scan: Scan; id: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const del = useDeleteScan();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const result = scan.result!;
  const level = result.riskLevel;
  const next = t(`next.${level}`, { returnObjects: true });
  const steps = Array.isArray(next) ? (next as string[]) : [];
  const showDetails = level === 'very_high' || level === 'high' || result.entities.length > 0;
  // The old law sections named in the notice are shown right under the reason about them.
  const reasons = result.reasonCodes.flatMap((code) => [
    t(`reasons.${code}`),
    ...(code === 'outdated_section'
      ? result.statutes.map(({ cited, current }) => t('statutes.line', { cited, current }))
      : []),
  ]);

  async function warnFamily() {
    const outcome = await shareOrCopy(
      t('share.message', { level: t(`risk.label.${level}`) }),
      t('app.name'),
    );
    if (outcome === 'copied') toast.success(t('scan.warnCopied'));
    if (outcome === 'failed') toast.error(t('errors.generic'));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader backTo="/app" title={t('scan.resultTitle')} />

      {scan.simulated && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm font-semibold text-warn"
        >
          <FlaskConical className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          {t('scan.simulatedNote')}
        </p>
      )}

      <RiskCard level={level} reasons={reasons} onWrongResult={() => setFeedbackOpen(true)} />

      {steps.length > 0 && (
        <section
          aria-labelledby="next-title"
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
        >
          <h2 id="next-title" className="font-extrabold">
            {t('next.title')}
          </h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {showDetails && (
          <Link
            to={`/app/scan/${id}/details`}
            className={buttonVariants({ size: 'lg', block: true })}
          >
            {t('scan.reviewDetails')}
          </Link>
        )}
        <a
          href="tel:1930"
          className={buttonVariants({ variant: 'danger', size: 'lg', block: true })}
        >
          <Phone className="size-5" aria-hidden="true" />
          {t('emergency.call')}
        </a>
        <Button variant="outline" size="lg" block onClick={() => void warnFamily()}>
          <Share2 className="size-5" aria-hidden="true" />
          {t('scan.warnFamily')}
        </Button>
      </div>

      <section className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted">
        <p>{t('scan.deleteAt', { time: formatTime(scan.expiresAt, i18n.language) })}</p>
        <div>
          <Button
            variant="ghost"
            onClick={async () => {
              await del.mutateAsync(id);
              toast.success(t('scan.deleted'));
              navigate('/app');
            }}
          >
            <Trash2 className="size-5" aria-hidden="true" />
            {t('scan.deleteNow')}
          </Button>
        </div>
      </section>

      <FeedbackDialog scanId={id} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}

function Failed() {
  const { t } = useTranslation();
  return (
    <StateMessage
      icon={TriangleAlert}
      title={t('errors.generic')}
      message={t('errors.invalid')}
      action={
        <Link to="/app" className={buttonVariants()}>
          {t('common.goHome')}
        </Link>
      }
    />
  );
}

export default function ScanView() {
  return (
    <WithScan>
      {(scan, id) => {
        if (scan.status === 'done') return <Done scan={scan} id={id} />;
        if (scan.status === 'failed') return <Failed />;
        return <Processing scan={scan} id={id} />;
      }}
    </WithScan>
  );
}
