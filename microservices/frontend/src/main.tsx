import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { ready } from './i18n';
import './index.css';
import App from './App.tsx';
import Maintenance from './pages/Maintenance.tsx';
import { startsLikePrerendered, ThemeProvider } from './theme/ThemeProvider.tsx';

/** Set VITE_MAINTENANCE=true when building to show only the maintenance page. */
const maintenance = import.meta.env.VITE_MAINTENANCE === 'true';

/**
 * Public pages are sent already written out, in English, with the default look (see
 * scripts/prerender.mjs). They stay on screen until the app takes over, but only when they are what
 * this person would see anyway: the same page, in English, in the default look. Otherwise they are
 * removed first, so nobody sees a flash of the wrong page, language or colours.
 */
function keepPrerendered(): boolean {
  const here = location.pathname.replace(/\/+$/, '') || '/';
  return (
    document.documentElement.dataset.prerendered === here &&
    i18n.language === 'en' &&
    startsLikePrerendered()
  );
}

const root = document.getElementById('root')!;
if (!keepPrerendered()) root.replaceChildren();
// A small script in the page (scripts/skip-prerender.js) may have hidden the written-out page until
// now. Whatever is left in the root is meant to be seen.
delete document.documentElement.dataset.skipPrerender;
delete document.documentElement.dataset.prerendered;

void ready.then(() => {
  createRoot(root).render(
    <StrictMode>
      {maintenance ? (
        <ThemeProvider>
          <Maintenance />
        </ThemeProvider>
      ) : (
        <App />
      )}
    </StrictMode>,
  );
});
