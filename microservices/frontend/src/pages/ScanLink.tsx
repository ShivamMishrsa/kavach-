import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { normalizeUrl } from '@/api/mock/analyze';
import { useCreateScan } from '@/api/queries';
import { ConsentCard } from '@/components/ConsentCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useConsent } from '@/consent/ConsentProvider';
import { errorKey } from '@/lib/errors';

const DEMO_LINKS = [
  { id: 'lookalike', url: 'http://sbi-kyc-update.example/verify' },
  { id: 'official', url: 'https://www.sbi.co.in' },
] as const;

export default function ScanLink() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { granted } = useConsent();
  const create = useCreateScan();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizeUrl(url)) {
      setError(t('link.invalid'));
      return;
    }
    setError(undefined);
    try {
      const scan = await create.mutateAsync({ kind: 'link', url });
      navigate(`/app/scan/${scan.id}`);
    } catch (problem) {
      setError(t(errorKey(problem)));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader backTo="/app" title={t('link.title')} subtitle={t('link.subtitle')} />
      <ConsentCard />

      <form onSubmit={(event) => void submit(event)} noValidate>
        <fieldset
          disabled={!granted || create.isPending}
          className="flex flex-col gap-4 disabled:opacity-60"
        >
          <legend className="sr-only">{t('link.title')}</legend>
          <Input
            label={t('link.label')}
            hint={t('link.hint')}
            error={error}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" size="lg" block disabled={url.trim() === ''}>
            {create.isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                {t('common.checking')}
              </>
            ) : (
              t('link.submit')
            )}
          </Button>
        </fieldset>
      </form>

      <section
        aria-labelledby="demo-links"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h2 id="demo-links" className="font-extrabold">
          {t('link.demoTitle')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {DEMO_LINKS.map((demo) => (
            <Button key={demo.id} variant="outline" onClick={() => setUrl(demo.url)}>
              {t(`link.demo.${demo.id}`)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
