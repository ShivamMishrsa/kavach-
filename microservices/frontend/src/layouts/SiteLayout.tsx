import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { Brand } from '@/components/Brand';
import { DemoBanner } from '@/components/DemoBanner';
import { LanguageSelect } from '@/components/LanguageSelect';
import { buttonVariants } from '@/components/ui/button-variants';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';

const LINKS = [
  { to: '/emergency', label: 'sentMoney.title' },
  { to: '/help', label: 'nav.help' },
  { to: '/privacy', label: 'site.privacy' },
  { to: '/terms', label: 'site.terms' },
  { to: '/limitations', label: 'site.limitations' },
];

const WIDTH = 'mx-auto w-full max-w-5xl px-4';

/** Layout for the public website: landing page, help, 1930 page and the legal pages. */
export function SiteLayout() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        {t('common.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className={`${WIDTH} flex items-center gap-3 py-3`}>
          <Link to="/" aria-label={t('common.brandHome')} className="rounded-lg">
            <Brand />
          </Link>
          <nav aria-label={t('nav.main')} className="ml-4 hidden gap-1 lg:flex">
            {LINKS.slice(0, 3).map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-11 items-center rounded-lg px-3 font-semibold text-muted hover:bg-chip"
              >
                {t(label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelect compact />
            <button
              type="button"
              aria-label={t('site.theme')}
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="flex size-11 items-center justify-center rounded-xl border-2 border-border text-muted hover:bg-chip"
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
            <Link to="/start" className={cn(buttonVariants(), 'hidden sm:inline-flex')}>
              {t('landing.cta')}
            </Link>
          </div>
        </div>
      </header>

      <div className={`${WIDTH} flex flex-col gap-2 pt-3`}>
        <DemoBanner />
        <EmergencyStrip />
      </div>

      <main id="main" className={`${WIDTH} flex flex-1 flex-col py-6`}>
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className={`${WIDTH} flex flex-col gap-3 py-6`}>
          <nav aria-label={t('site.more')} className="flex flex-wrap gap-x-5">
            {LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-11 items-center font-semibold text-primary"
              >
                {t(label)}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-muted">{t('site.footer')}</p>
        </div>
      </footer>
    </div>
  );
}
