import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useCreateScan } from '@/api/queries';
import { ApiError, type Scan, type ScanInput } from '@/api/types';
import { planFor, shrinkImage } from '@/lib/compressImage';
import { useLowData } from '@/lib/lowData';
import { usePending } from './PendingProvider';
import { toPending } from './queue';

/**
 * Sends a check. A big photo is made smaller first. If there is no connection, the check is kept on
 * the phone (see ./queue) and the person is taken home, where it is listed; that returns null.
 * Any other problem is thrown for the screen to show.
 */
export function useSendOrKeep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateScan();
  const pending = usePending();
  const lowData = useLowData();
  const [preparing, setPreparing] = useState(false);

  const send = useCallback(
    async (input: ScanInput): Promise<Scan | null> => {
      let ready = input;
      if (input.kind === 'notice' && input.file) {
        setPreparing(true);
        const file = await shrinkImage(input.file, planFor(lowData)).finally(() =>
          setPreparing(false),
        );
        ready = { ...input, file };
      }
      try {
        return await create.mutateAsync(ready);
      } catch (problem) {
        const keep = problem instanceof ApiError && problem.code === 'network' && toPending(ready);
        if (keep && (await pending.saveForLater(keep))) {
          toast.success(t('pending.saved'));
          navigate('/app');
          return null;
        }
        throw problem;
      }
    },
    [create, pending, lowData, navigate, t],
  );

  return { send, busy: preparing || create.isPending };
}
