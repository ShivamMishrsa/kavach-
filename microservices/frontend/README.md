# frontend/

React + Vite + TypeScript website and PWA. Hindi-first, mobile-first, light default with dark option.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Type-check and production build |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests |
| `npm run check:contrast` | WCAG contrast check of the colour tokens (light, dark, high contrast) |
| `npm run format` | Prettier |

## Structure

- `src/styles/tokens.css`: design tokens (change colours here)
- `src/theme/`: theme provider (light default, dark, auto, text size, high contrast)
- `src/i18n/`: Hindi and English text (`locales/hi.json`, `locales/en.json`)
- `src/components/ui/`: reusable components (Button, RiskCard, UploadBox, Stepper, EntityField, Dialog...)
- `src/pages/DesignSystem.tsx`: internal page showing every component

## Rules

- No hard-coded colours or text in components; use tokens and translation keys.
- Result screens show a risk level with reasons, never "100% fake" or an accuracy percentage.

Design: Option A "Calm Trust" (`../../design-mockups/`). Steps: see `../../build-phases/`.
