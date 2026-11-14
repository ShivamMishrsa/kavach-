import { useTranslation } from 'react-i18next';
import { LanguageSelect } from '@/components/LanguageSelect';
import { Segmented } from '@/components/ui/Segmented';
import { useLowDataChoice } from '@/lib/lowData';
import { useTheme } from '@/theme/ThemeProvider';

/** Language, theme (light default), text size and contrast. Used on the settings page later. */
export function SettingsPanel() {
  const { t } = useTranslation();
  const { theme, setTheme, text, setText, highContrast, setHighContrast } = useTheme();
  const [lowData, setLowData] = useLowDataChoice();

  return (
    <div className="flex flex-col gap-4">
      <LanguageSelect />
      <Segmented
        label={t('settings.theme')}
        value={theme}
        options={[
          { value: 'light', label: t('settings.themeLight') },
          { value: 'dark', label: t('settings.themeDark') },
          { value: 'auto', label: t('settings.themeAuto') },
        ]}
        onChange={setTheme}
      />
      <Segmented
        label={t('settings.textSize')}
        value={text}
        options={[
          { value: 'normal', label: t('settings.sizeNormal') },
          { value: 'large', label: t('settings.sizeLarge') },
          { value: 'xlarge', label: t('settings.sizeXlarge') },
        ]}
        onChange={setText}
      />
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={highContrast}
          onChange={(event) => setHighContrast(event.target.checked)}
          className="size-5 accent-primary"
        />
        {t('settings.highContrast')}
      </label>
      <div className="flex flex-col gap-1">
        <Segmented
          label={t('lowData.title')}
          value={lowData}
          options={[
            { value: 'auto', label: t('lowData.auto') },
            { value: 'on', label: t('lowData.on') },
            { value: 'off', label: t('lowData.off') },
          ]}
          onChange={setLowData}
        />
        <p className="text-sm text-muted">{t('lowData.hint')}</p>
      </div>
    </div>
  );
}
