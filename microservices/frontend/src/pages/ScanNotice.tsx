import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { SampleId } from '@/api/types';
import { ConsentCard } from '@/components/ConsentCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/Segmented';
import { Textarea } from '@/components/ui/Textarea';
import { UploadBox } from '@/components/ui/UploadBox';
import { useConsent } from '@/consent/ConsentProvider';
import { getLanguageInfo } from '@/i18n';
import { planFor, worthShrinking } from '@/lib/compressImage';
import { errorKey } from '@/lib/errors';
import { useLowData } from '@/lib/lowData';
import { useFilePreview } from '@/lib/useFilePreview';
import { useSharedInput } from '@/lib/useSharedInput';
import { useSendOrKeep } from '@/offline/useSendOrKeep';

const SAMPLES: SampleId[] = ['fake_notice', 'courier_link', 'unclear_photo', 'bank_alert'];

export default function ScanNotice() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { granted } = useConsent();
  const shared = useSharedInput(); // a message sent here with "Share" from another app
  const { send, busy } = useSendOrKeep();
  const lowData = useLowData();

  const [mode, setMode] = useState<'file' | 'text'>(shared.text ? 'text' : 'file');
  const [text, setText] = useState(shared.text?.slice(0, 5000) ?? '');
  const [error, setError] = useState<string | null>(null);
  const { file, previewUrl: preview, setFile } = useFilePreview();

  const ready = granted && (mode === 'file' ? file !== null : text.trim().length > 0);
  const limited = getLanguageInfo(i18n.language).scanSupport === 'limited';

  async function run(input: Parameters<typeof send>[0]) {
    setError(null);
    try {
      const scan = await send(input);
      if (scan) navigate(`/app/scan/${scan.id}`);
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

      <fieldset disabled={!granted || busy} className="flex flex-col gap-4 disabled:opacity-60">
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
            {file && worthShrinking(file, planFor(lowData)) && (
              <p className="text-sm text-muted">{t('upload.willShrink')}</p>
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
          disabled={!ready || busy}
          onClick={() =>
            void run(mode === 'file' ? { kind: 'notice', file: file! } : { kind: 'notice', text })
          }
        >
          {busy ? (
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
              disabled={busy}
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
