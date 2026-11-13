import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tag?: string;
  tone?: 'default' | 'danger';
}

/** Big tappable card used on the home screen. */
export function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  tag,
  tone = 'default',
}: ActionCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-16 items-center gap-3 rounded-card border-2 bg-surface p-3 hover:bg-chip',
        tone === 'danger' ? 'border-danger' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex size-11 flex-none items-center justify-center rounded-xl',
          tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-chip text-primary',
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-bold">
          {title}
          {tag && (
            <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-bold text-muted">
              {tag}
            </span>
          )}
        </span>
        <span className="text-sm text-muted">{description}</span>
      </span>
      <ChevronRight className="size-5 flex-none text-muted" aria-hidden="true" />
    </Link>
  );
}
