import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function DialogContent({ title, description, children }: DialogContentProps) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <DialogPrimitive.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-card border border-border bg-surface p-5 shadow-xl">
        <DialogPrimitive.Title className="pr-8 text-lg font-extrabold">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-2 text-muted">
          {description}
        </DialogPrimitive.Description>
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close
          aria-label={t('dialog.close')}
          className="absolute top-2 right-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-chip"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
