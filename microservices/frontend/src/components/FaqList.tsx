import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

/** The common questions, as expandable rows. Used on the help page and the landing page. */
export function FaqList() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      {QUESTIONS.map((question) => (
        <details
          key={question}
          className="group rounded-card border border-border bg-surface px-4 py-1"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-bold">
            {t(`help.${question}.q`)}
            <ChevronDown
              className="size-5 flex-none transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="pb-3 text-muted">{t(`help.${question}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
