import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, children }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-col gap-2">
      {backTo && (
        <Link
          to={backTo}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('common.back')}
        </Link>
      )}
      <h1 className="text-2xl leading-tight font-extrabold">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
      {children}
    </header>
  );
}
