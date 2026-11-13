import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSendFeedback } from '@/api/queries';
import type { FeedbackType } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';

const TYPES: FeedbackType[] = ['false_alarm', 'missed_scam', 'wrong_wording', 'other'];

interface FeedbackDialogProps {
  scanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Result looks wrong?" Feedback never includes the file, only the choice and a short note. */
export function FeedbackDialog({ scanId, open, onOpenChange }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const send = useSendFeedback();
  const [type, setType] = useState<FeedbackType | null>(null);
  const [note, setNote] = useState('');

  async function submit() {
    if (!type) return;
    try {
      await send.mutateAsync({ scanId, type, note: note.trim() || undefined });
      toast.success(t('feedback.thanks'));
      setType(null);
      setNote('');
      onOpenChange(false);
    } catch {
      toast.error(t('errors.generic'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('feedback.title')} description={t('feedback.description')}>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t('feedback.title')}</legend>
          {TYPES.map((option) => (
            <label
              key={option}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              <input
                type="radio"
                name="feedback-type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="size-5 accent-primary"
              />
              {t(`feedback.types.${option}`)}
            </label>
          ))}
        </fieldset>
        <div className="mt-3">
          <Textarea
            label={t('feedback.noteLabel')}
            hint={t('feedback.noteHint')}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={!type || send.isPending} onClick={() => void submit()}>
            {t('feedback.send')}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">{t('common.cancel')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
