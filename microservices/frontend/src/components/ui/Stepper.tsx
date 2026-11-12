import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'current' | 'waiting';

export interface StepItem {
  id: string;
  label: string;
  status: StepStatus;
}

export function Stepper({ steps }: { steps: StepItem[] }) {
  const { t } = useTranslation();
  return (
    <ol className="rounded-card border border-border bg-surface px-4">
      {steps.map((step, index) => (
        <li
          key={step.id}
          aria-current={step.status === 'current' ? 'step' : undefined}
          className="flex items-center gap-3 border-b border-dashed border-border py-3 last:border-b-0"
        >
          <span
            className={cn(
              'flex size-6 flex-none items-center justify-center rounded-full text-xs font-extrabold',
              step.status === 'done' && 'bg-ok text-on-risk',
              step.status === 'current' && 'bg-primary text-on-primary',
              step.status === 'waiting' && 'border-2 border-border text-muted',
            )}
          >
            {step.status === 'done' ? <Check className="size-4" aria-hidden="true" /> : index + 1}
          </span>
          <span className={cn(step.status === 'current' && 'font-bold')}>{step.label}</span>
          <span className="sr-only">
            {t(`stepper.${step.status === 'waiting' ? 'waiting' : step.status}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
