import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App.tsx';
import Maintenance from './pages/Maintenance.tsx';
import { ThemeProvider } from './theme/ThemeProvider.tsx';

/** Set VITE_MAINTENANCE=true when building to show only the maintenance page. */
const maintenance = import.meta.env.VITE_MAINTENANCE === 'true';

createRoot(document.getElementById('root')!).render(
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
