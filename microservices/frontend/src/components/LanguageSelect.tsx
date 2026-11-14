import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LIST, DEFAULT_LANGUAGE, isLanguage } from '@/i18n';

/**
 * Language dropdown (a native select works well with many languages).
 * `compact` hides the label and shows only the native name, for the site header.
 */
export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const current = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={compact ? 'sr-only' : 'font-semibold'}>
        {t('language.selectLabel')}
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className="min-h-11 rounded-[calc(var(--radius)-4px)] border-2 border-border bg-surface px-3 text-base"
      >
        {LANGUAGE_LIST.map((language) => (
          <option key={language.code} value={language.code} lang={language.code}>
            {compact ? language.nativeName : `${language.nativeName} (${language.englishName})`}
          </option>
        ))}
      </select>
    </div>
  );
}
