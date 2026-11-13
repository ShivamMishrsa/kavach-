import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LIST, isLanguage, type Language } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguagePickerProps {
  onSelect?: (language: Language) => void;
}

/**
 * "Choose your language" list for the first-run screen (shown after sign up, log in or
 * continue as guest). Each card is written in its own language so people can find theirs.
 */
export function LanguagePicker({ onSelect }: LanguagePickerProps) {
  const { t, i18n } = useTranslation();

  function choose(language: Language) {
    void i18n.changeLanguage(language);
    onSelect?.(language);
  }

  return (
    <div role="radiogroup" aria-label={t('language.selectLabel')} className="flex flex-col gap-2">
      {LANGUAGE_LIST.map((language) => {
        const selected = i18n.language === language.code;
        return (
          <button
            key={language.code}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={language.code}
            onClick={() => isLanguage(language.code) && choose(language.code)}
            className={cn(
              'flex min-h-14 items-center justify-between gap-3 rounded-card border-2 px-4 py-2 text-left',
              selected ? 'border-primary bg-chip' : 'border-border bg-surface hover:bg-chip',
            )}
          >
            <span className="flex flex-col">
              <span className="text-lg font-bold">{language.nativeName}</span>
              <span className="text-sm text-muted">
                {language.englishName}
                {' · '}
                {language.scanSupport === 'full'
                  ? t('language.scanFull')
                  : t('language.scanLimited')}
              </span>
              {language.reviewStatus === 'draft' && (
                <span className="text-xs font-semibold text-warn">{t('language.draft')}</span>
              )}
            </span>
            {selected && <Check className="size-6 flex-none text-primary" aria-hidden="true" />}
          </button>
        );
      })}
      <p className="text-sm text-muted">{t('language.hint')}</p>
    </div>
  );
}
