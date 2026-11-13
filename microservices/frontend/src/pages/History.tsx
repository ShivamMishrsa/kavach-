import { History as HistoryIcon, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useDeleteAllScans, useDeleteScan, useHistory } from '@/api/queries';
import { PageHeader } from '@/components/PageHeader';
import { Spinner, StateMessage } from '@/components/StateMessage';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { RiskBadge } from '@/components/ui/RiskCard';
import { formatDateTime } from '@/lib/format';

export default function History() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const deleteOne = useDeleteScan();
  const deleteAll = useDeleteAllScans();
  const items = history.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle')} />

      {history.isPending && <Spinner />}

      {history.isSuccess && items.length === 0 && (
        <StateMessage
          icon={HistoryIcon}
          title={t('history.emptyTitle')}
          message={t('history.emptyBody')}
          action={
            <Link to="/app" className={buttonVariants()}>
              {t('history.checkSomething')}
            </Link>
          }
        />
      )}

      {items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-card border border-border bg-surface pl-4"
              >
                <Link
                  to={`/app/scan/${item.id}`}
                  className="flex min-h-14 flex-1 flex-col justify-center py-2"
                >
                  <span className="font-semibold">{t(`kinds.${item.kind}`)}</span>
                  <span className="text-xs text-muted">
                    {formatDateTime(item.createdAt, i18n.language)}
                  </span>
                </Link>
                {item.riskLevel && <RiskBadge level={item.riskLevel} />}
                <button
                  type="button"
                  aria-label={t('history.deleteOne')}
                  onClick={() => deleteOne.mutate(item.id)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-chip"
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t('history.deleteAll')}</Button>
            </DialogTrigger>
            <DialogContent title={t('history.confirmTitle')} description={t('history.confirmBody')}>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await deleteAll.mutateAsync();
                      toast.success(t('history.deleted'));
                    }}
                  >
                    {t('history.deleteAll')}
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="ghost">{t('common.cancel')}</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
