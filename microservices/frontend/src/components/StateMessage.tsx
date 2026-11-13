import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StateMessageProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}

/** Empty, error and not-found states share one calm layout. */
export function StateMessage({ icon: Icon, title, message, action }: StateMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-5 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-chip text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {message && <p className="max-w-sm text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}
