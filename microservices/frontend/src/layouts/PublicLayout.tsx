import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { Brand } from '@/components/Brand';
import { DemoBanner } from '@/components/DemoBanner';
import { EmergencyStrip } from '@/components/ui/EmergencyStrip';

/** Layout for the first-run screens (welcome, log in, sign up, choose language). */
export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        {t('common.skipToContent')}
      </a>
      <header className="mx-auto flex w-full max-w-md items-center px-4 py-4">
        <Link to="/" aria-label={t('common.brandHome')} className="rounded-lg">
          <Brand />
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8">
        <DemoBanner />
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-md px-4 pb-6">
        <EmergencyStrip />
      </footer>
    </div>
  );
}
