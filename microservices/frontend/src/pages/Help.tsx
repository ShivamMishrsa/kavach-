import { ExternalLink, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FaqList } from '@/components/FaqList';
import { PageHeader } from '@/components/PageHeader';
import { buttonVariants } from '@/components/ui/button-variants';

export default function Help() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('help.title')} subtitle={t('help.subtitle')} />

      <section aria-labelledby="contacts-title" className="flex flex-col gap-2">
        <h2 id="contacts-title" className="text-lg font-extrabold">
          {t('help.contacts')}
        </h2>
        <a
          href="tel:1930"
          className={buttonVariants({ variant: 'danger', size: 'lg', block: true })}
        >
          <Phone className="size-5" aria-hidden="true" />
          {t('emergency.call')}
        </a>
        <a
          href="https://cybercrime.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'lg', block: true })}
        >
          <ExternalLink className="size-5" aria-hidden="true" />
          {t('sentMoney.portal')}
        </a>
      </section>

      <section aria-labelledby="faq-title" className="flex flex-col gap-2">
        <h2 id="faq-title" className="text-lg font-extrabold">
          {t('help.faq')}
        </h2>
        <FaqList />
      </section>
    </div>
  );
}
