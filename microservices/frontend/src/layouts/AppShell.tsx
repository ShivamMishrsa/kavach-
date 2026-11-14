import { CircleHelp, History, House, Settings, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { Brand } from '@/components/Brand';
import { DemoBanner } from '@/components/DemoBanner';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';
import { PendingProvider } from '@/offline/PendingProvider';
import { OfflineBanner } from '@/pwa/OfflineBanner';
import { preloadAppScreens } from '@/lib/preload';
import { cn } from '@/lib/utils';

const NAV: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: '/app', end: true, icon: House, label: 'nav.home' },
  { to: '/app/history', icon: History, label: 'nav.history' },
  { to: '/app/help', icon: CircleHelp, label: 'nav.help' },
  { to: '/app/settings', icon: Settings, label: 'nav.settings' },
];

/** Bottom navigation on phones, side navigation on larger screens. */
export function AppShell() {
  const { t } = useTranslation();
  useEffect(preloadAppScreens, []);

  return (
    <PendingProvider>
      <div className="min-h-dvh md:flex">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          {t('common.skipToContent')}
        </a>

        <aside className="hidden border-r border-border bg-surface px-3 py-5 md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-none md:flex-col md:gap-4">
          <Link to="/app" aria-label={t('common.brandHome')} className="px-2">
            <Brand />
          </Link>
          <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
            {NAV.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold',
                    isActive ? 'bg-chip text-primary' : 'text-muted hover:bg-chip',
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto">
            <EmergencyStrip />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-surface px-4 py-3 md:hidden">
            <Link to="/app" aria-label={t('common.brandHome')}>
              <Brand />
            </Link>
          </header>

          <main
            id="main"
            className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5 pb-28 md:pb-10"
          >
            <DemoBanner />
            <OfflineBanner />
            <div className="md:hidden">
              <EmergencyStrip />
            </div>
            <Outlet />
          </main>
        </div>

        <nav
          aria-label={t('nav.main')}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface md:hidden"
        >
          {NAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              <Icon className="size-6" aria-hidden="true" />
              {t(label)}
            </NavLink>
          ))}
        </nav>
      </div>
    </PendingProvider>
  );
}
