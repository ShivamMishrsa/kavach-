import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { copyText } from '@/lib/share';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  text: string;
  label: string;
  variant?: 'outline' | 'ghost';
}

export function CopyButton({ text, label, variant = 'outline' }: CopyButtonProps) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  async function copy() {
    if (await copyText(text)) {
      setDone(true);
      toast.success(t('common.copied'));
      window.setTimeout(() => setDone(false), 2000);
    } else {
      toast.error(t('errors.generic'));
    }
  }

  return (
    <Button variant={variant} onClick={() => void copy()}>
      {done ? (
        <Check className="size-5" aria-hidden="true" />
      ) : (
        <Copy className="size-5" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
