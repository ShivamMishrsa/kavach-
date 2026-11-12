import { Camera, FileUp, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { DEFAULT_ACCEPT, validateFile, type UploadError } from './upload-utils';

interface UploadBoxProps {
  accept?: string[];
  maxMb?: number;
  onFile?: (file: File | null) => void;
}

export function UploadBox({ accept = DEFAULT_ACCEPT, maxMb = 10, onFile }: UploadBoxProps) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<UploadError | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept_(next: File | undefined) {
    if (!next) return;
    const problem = validateFile(next, accept, maxMb);
    if (problem) {
      setError(problem);
      setFile(null);
      onFile?.(null);
      return;
    }
    setError(null);
    setFile(next);
    onFile?.(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    accept_(event.dataTransfer.files[0]);
  }

  function clear() {
    setFile(null);
    setError(null);
    onFile?.(null);
    if (fileInput.current) fileInput.current.value = '';
    if (cameraInput.current) cameraInput.current.value = '';
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border-2 border-dashed bg-surface p-5 text-center',
        dragging ? 'border-primary bg-chip' : 'border-border',
      )}
    >
      <p className="font-semibold">{t('upload.dropHint')}</p>
      <p className="text-sm text-muted">{t('upload.limits', { max: maxMb })}</p>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="primary" onClick={() => fileInput.current?.click()}>
          <FileUp className="size-5" aria-hidden="true" />
          {t('upload.chooseFile')}
        </Button>
        <Button variant="outline" onClick={() => cameraInput.current?.click()}>
          <Camera className="size-5" aria-hidden="true" />
          {t('upload.camera')}
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={accept.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => accept_(event.target.files?.[0])}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => accept_(event.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t(`upload.${error}`, { max: maxMb })}
        </p>
      )}
      {file && (
        <p className="flex items-center gap-2 text-sm">
          <span>{t('upload.selected', { name: file.name })}</span>
          <button
            type="button"
            onClick={clear}
            aria-label={t('upload.remove')}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-chip"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </p>
      )}
    </div>
  );
}
