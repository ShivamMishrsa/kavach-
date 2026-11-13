import { SearchX, Timer, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useScan } from '@/api/queries';
import { ApiError, type Scan } from '@/api/types';
import { Spinner, StateMessage } from '@/components/StateMessage';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';

/** Loads a scan by the id in the URL and shows friendly loading, expired and error screens. */
export function WithScan({ children }: { children: (scan: Scan, id: string) => ReactNode }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const query = useScan(id);

  if (!id) return null;
  if (query.isPending) return <Spinner />;

  if (query.isError) {
    const code = query.error instanceof ApiError ? query.error.code : 'network';
    const home = (
      <Link to="/app" className={buttonVariants()}>
        {t('common.goHome')}
      </Link>
    );
    if (code === 'expired') {
      return (
        <StateMessage
          icon={Timer}
          title={t('scan.expiredTitle')}
          message={t('scan.expiredBody')}
          action={home}
        />
      );
    }
    if (code === 'not_found') {
      return <StateMessage icon={SearchX} title={t('scan.notFoundTitle')} action={home} />;
    }
    return (
      <StateMessage
        icon={TriangleAlert}
        title={t('errors.generic')}
        action={<Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>}
      />
    );
  }

  return <>{children(query.data, id)}</>;
}
