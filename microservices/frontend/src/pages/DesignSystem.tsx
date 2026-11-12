import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';
import { EntityField } from '@/components/ui/EntityField';
import { RiskCard } from '@/components/ui/RiskCard';
import type { RiskLevel } from '@/components/ui/risk';
import { Stepper, type StepItem } from '@/components/ui/Stepper';
import { UploadBox } from '@/components/ui/UploadBox';

const LEVELS: RiskLevel[] = ['very_high', 'high', 'medium', 'cannot_verify', 'low'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

/** Internal page to check every component in light and dark. Not a user-facing screen. */
export default function DesignSystem() {
  const { t } = useTranslation();
  const [utr, setUtr] = useState('4XXXXXXXXXXX');
  const [upi, setUpi] = useState('name@upi');
  const [amount, setAmount] = useState('₹50,000');

  const steps: StepItem[] = [
    { id: 'received', label: t('demo.steps.received'), status: 'done' },
    { id: 'read', label: t('demo.steps.read'), status: 'done' },
    { id: 'signals', label: t('demo.steps.signals'), status: 'current' },
    { id: 'report', label: t('demo.steps.report'), status: 'waiting' },
  ];

  const reasons = ['digital_arrest', 'payment_demand', 'safe_account', 'secrecy'].map((key) =>
    t(`demo.reasons.${key}`),
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold">
          {t('app.name')} · {t('demo.title')}
        </h1>
        <p className="mt-1 text-muted">{t('demo.subtitle')}</p>
      </header>

      <EmergencyStrip />

      <Section title={t('demo.settingsTitle')}>
        <SettingsPanel />
      </Section>

      <Section title={t('demo.buttons')}>
        <div className="flex flex-wrap gap-2">
          <Button>{t('actions.primary')}</Button>
          <Button variant="outline">{t('actions.outline')}</Button>
          <Button variant="danger">{t('actions.danger')}</Button>
          <Button variant="ghost">{t('actions.ghost')}</Button>
          <Button size="lg" block>
            {t('actions.primary')}
          </Button>
        </div>
      </Section>

      <Section title={t('demo.riskCards')}>
        <div className="flex flex-col gap-8">
          {LEVELS.map((level) => (
            <RiskCard
              key={level}
              level={level}
              reasons={level === 'very_high' || level === 'high' ? reasons : []}
              onWrongResult={() => toast(t('risk.wrongResult'))}
            />
          ))}
        </div>
      </Section>

      <Section title={t('demo.upload')}>
        <UploadBox />
      </Section>

      <Section title={t('demo.stepper')}>
        <Stepper steps={steps} />
      </Section>

      <Section title={t('demo.entities')}>
        <div className="rounded-card border border-border bg-surface px-4">
          <EntityField label={t('demo.fields.utr')} value={utr} onChange={setUtr} />
          <EntityField label={t('demo.fields.upi')} value={upi} onChange={setUpi} />
          <EntityField label={t('demo.fields.amount')} value={amount} onChange={setAmount} />
        </div>
      </Section>

      <Section title={t('demo.dialog')}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('demo.openConsent')}</Button>
          </DialogTrigger>
          <DialogContent title={t('consent.title')} description={t('consent.body')}>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button>{t('consent.agree')}</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="ghost">{t('consent.decline')}</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title={t('demo.toast')}>
        <div>
          <Button variant="outline" onClick={() => toast.success(t('demo.toastText'))}>
            {t('demo.showToast')}
          </Button>
        </div>
      </Section>
    </main>
  );
}
