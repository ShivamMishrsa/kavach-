import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

const DOCS = ['privacy', 'terms', 'limitations'];

interface Section {
  h: string;
  p: string[];
}

/** Privacy policy, terms and limitations. Written in English and Hindi; other languages see English. */
export default function Legal() {
  const { t, i18n } = useTranslation('legal');
  const name = useLocation().pathname.slice(1);
  const doc = DOCS.find((item) => item === name) ?? DOCS[0];
  const sections = t(`${doc}.sections`, { returnObjects: true }) as Section[];
  const hasOwnText = i18n.language === 'en' || i18n.language === 'hi';

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t(`${doc}.title`)}</h1>
      {!hasOwnText && (
        <p role="note" className="rounded-lg bg-chip px-3 py-2 text-sm font-semibold">
          {i18n.t('site.legalLangNote')}
        </p>
      )}
      <p role="note" className="rounded-lg bg-warn-bg px-3 py-2 text-sm font-semibold text-warn">
        {t('draft')}
      </p>
      {sections.map(({ h, p }) => (
        <section key={h} className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold">{h}</h2>
          {p.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
