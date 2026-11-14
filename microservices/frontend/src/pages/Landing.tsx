import {
  Banknote,
  Check,
  Code,
  FileImage,
  Link2,
  Mic,
  Upload,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FaqList } from '@/components/FaqList';
import { buttonVariants } from '@/components/ui/button-variants';
import { LevelBar, RiskBadge, RiskCard } from '@/components/ui/RiskCard';
import { cn } from '@/lib/utils';

const TYPES: { key: 'arrest' | 'link' | 'voice' | 'paid'; icon: LucideIcon }[] = [
  { key: 'arrest', icon: Video },
  { key: 'link', icon: Link2 },
  { key: 'voice', icon: Mic },
  { key: 'paid', icon: Banknote },
];
const STEPS = ['s1', 's2', 's3'] as const;
const PRIVACY_POINTS = ['p1', 'p2', 'p3', 'p4'] as const;
const SAMPLE_REASONS = ['digital_arrest', 'payment_demand', 'safe_account'] as const;

interface SectionProps {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

function Section({ id, title, subtitle, children }: SectionProps) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="flex flex-col gap-4 py-8">
      <div>
        <h2 id={`${id}-title`} className="text-2xl font-extrabold md:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

const card = 'rounded-card border border-border bg-surface p-4';

/** Small pictures of each step, built from the real components so they match the app and the language. */
function StepPicture({ step }: { step: (typeof STEPS)[number] }) {
  const { t } = useTranslation();
  const frame = 'rounded-xl border border-border bg-bg p-3';
  return (
    <div aria-hidden="true" className="select-none">
      {step === 's1' && (
        <div
          className={cn(
            frame,
            'flex flex-col items-center gap-2 border-2 border-dashed text-sm text-muted',
          )}
        >
          <Upload className="size-6 text-primary" />
          <span className="flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 font-semibold text-primary">
            <FileImage className="size-4" />
            notice.jpg
          </span>
        </div>
      )}
      {step === 's2' && (
        <div className={cn(frame, 'flex flex-col gap-2')}>
          <span className="self-start">
            <RiskBadge level="very_high" />
          </span>
          <LevelBar level="very_high" />
        </div>
      )}
      {step === 's3' && (
        <dl className={cn(frame, 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm')}>
          <dt className="text-muted">{t('fields.utr')}</dt>
          <dd className="font-mono font-semibold">4000 0000 0001</dd>
          <dt className="text-muted">{t('fields.upi')}</dt>
          <dd className="font-mono font-semibold">name@upi</dd>
          <dt className="text-muted">SHA-256</dt>
          <dd className="font-mono font-semibold">a3f9…c71e</dd>
        </dl>
      )}
    </div>
  );
}

/** Public home page: what Kavach does, how it treats your data, and a direct way into a check. */
export default function Landing() {
  const { t } = useTranslation();

  return (
    <>
      <section className="grid items-center gap-8 py-4 md:grid-cols-2 md:py-8">
        <div className="flex flex-col gap-4">
          <p className="self-start rounded-full bg-chip px-3 py-1 text-sm font-bold text-primary">
            {t('landing.badge')}
          </p>
          <h1 className="text-4xl leading-tight font-extrabold md:text-5xl">{t('app.tagline')}</h1>
          <p className="text-lg text-muted">{t('welcome.subtitle')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/start" className={buttonVariants({ size: 'lg' })}>
              {t('landing.cta')}
            </Link>
            <a href="#how" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('landing.how.title')}
            </a>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm font-semibold text-ok">
            {[t('landing.noAccount'), t('welcome.point3')].map((text) => (
              <li key={text} className="flex items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1">
                <Check className="size-4" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-muted">{t('landing.sample')}</p>
          <RiskCard
            level="very_high"
            reasons={SAMPLE_REASONS.map((reason) => t(`reasons.${reason}`))}
          />
        </div>
      </section>

      <Section id="types" title={t('landing.types.title')} subtitle={t('landing.types.subtitle')}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(({ key, icon: Icon }) => (
            <li key={key} className={cn(card, 'flex flex-col gap-2')}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-chip text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-extrabold">{t(`landing.types.${key}.title`)}</h3>
              <p className="text-sm text-muted">{t(`landing.types.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how" title={t('landing.how.title')} subtitle={t('landing.how.subtitle')}>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className={cn(card, 'flex flex-col gap-2')}>
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full bg-primary font-extrabold text-on-primary"
              >
                {index + 1}
              </span>
              <h3 className="font-extrabold">{t(`landing.how.${step}.title`)}</h3>
              <p className="text-sm text-muted">{t(`landing.how.${step}.body`)}</p>
              <div className="mt-auto pt-2">
                <StepPicture step={step} />
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="privacy" title={t('landing.privacy.title')}>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <ul className="flex flex-col gap-2">
            {PRIVACY_POINTS.map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 size-5 flex-none text-ok" aria-hidden="true" />
                {t(`landing.privacy.${point}`)}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-card bg-ok-bg p-4 text-ok">
            <p className="font-semibold">{t('landing.privacy.honest')}</p>
            <Link to="/privacy" className="min-h-11 self-start py-2 font-bold underline">
              {t('landing.privacy.more')}
            </Link>
          </div>
        </div>
      </Section>

      <Section id="api" title={t('landing.api.title')}>
        <div className={cn(card, 'flex items-start gap-3')}>
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-chip text-primary">
            <Code className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="self-start rounded-full bg-warn-bg px-3 py-0.5 text-sm font-bold text-warn">
              {t('landing.api.badge')}
            </p>
            <p>{t('landing.api.body')}</p>
          </div>
        </div>
      </Section>

      <Section id="faq" title={t('help.faq')}>
        <FaqList />
      </Section>

      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <h2 className="text-2xl font-extrabold">{t('app.tagline')}</h2>
        <Link to="/start" className={buttonVariants({ size: 'lg' })}>
          {t('landing.cta')}
        </Link>
      </div>
    </>
  );
}
