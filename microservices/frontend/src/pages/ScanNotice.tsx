import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCreateScan } from '@/api/queries';
import type { SampleId } from '@/api/types';
import { ConsentCard } from '@/components/ConsentCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/Segmented';
import { Textarea } from '@/components/ui/Textarea';
import { UploadBox } from '@/components/ui/UploadBox';
import { useConsent } from '@/consent/ConsentProvider';
import { getLanguageInfo } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { useFilePreview } from '@/lib/useFilePreview';

const SAMPLES: SampleId[] = ['fake_notice', 'courier_link', 'unclear_photo', 'bank_alert'];

export default function ScanNotice() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { granted } = useConsent();
  const create = useCreateScan();

  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { file, previewUrl: preview, setFile } = useFilePreview();

  const ready = granted && (mode === 'file' ? file !== null : text.trim().length > 0);
  const limited = getLanguageInfo(i18n.language).scanSupport === 'limited';

  async function run(input: Parameters<typeof create.mutateAsync>[0]) {
    setError(null);
    try {
      const scan = await create.mutateAsync(input);
      navigate(`/app/scan/${scan.id}`);
    } catch (problem) {
      setError(t(errorKey(problem)));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader backTo="/app" title={t('notice.title')} subtitle={t('notice.subtitle')} />

      <ConsentCard />

      {limited && (
        <p role="note" className="rounded-lg bg-chip px-3 py-2 text-sm">
          {t('notice.limitedNote')}
        </p>
      )}

      <fieldset
        disabled={!granted || create.isPending}
        className="flex flex-col gap-4 disabled:opacity-60"
      >
        <legend className="sr-only">{t('notice.title')}</legend>
        <Segmented
          label={t('notice.modeLabel')}
          value={mode}
          options={[
            { value: 'file', label: t('notice.modeFile') },
            { value: 'text', label: t('notice.modeText') },
          ]}
          onChange={setMode}
        />

        {mode === 'file' ? (
          <div className="flex flex-col gap-3">
            <UploadBox onFile={setFile} />
            {preview && (
              <img
                src={preview}
                alt={t('notice.previewAlt')}
                className="max-h-64 w-full rounded-card border border-border object-contain"
              />
            )}
            {file && !preview && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <FileText className="size-5" aria-hidden="true" />
                {file.name}
              </p>
            )}
          </div>
        ) : (
          <Textarea
            label={t('notice.textLabel')}
            hint={t('notice.textHint')}
            value={text}
            maxLength={5000}
            onChange={(event) => setText(event.target.value)}
          />
        )}

        {error && (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        )}

        <Button
          size="lg"
          block
          disabled={!ready || create.isPending}
          onClick={() =>
            void run(mode === 'file' ? { kind: 'notice', file: file! } : { kind: 'notice', text })
          }
        >
          {create.isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              {t('common.checking')}
            </>
          ) : (
            t('notice.submit')
          )}
        </Button>
      </fieldset>

      <section
        aria-labelledby="samples-title"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2 id="samples-title" className="font-extrabold">
          {t('notice.samplesTitle')}
        </h2>
        <p className="text-sm text-muted">{t('notice.samplesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <Button
              key={sample}
              variant="outline"
              disabled={create.isPending}
              onClick={() => void run({ kind: 'notice', sampleId: sample })}
            >
              {t(`samples.${sample}`)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
