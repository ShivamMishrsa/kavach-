# frontend/

React + Vite + TypeScript website and PWA. Mobile-first, English default with regional languages, light default with dark option.

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
- `src/i18n/`: language registry (`languages.ts`), on-demand script fonts (`fonts.ts`) and one JSON file per language in `locales/` (en, hi, bn, mr, ta, te, gu). English is the default. Translations other than English are drafts until a native speaker reviews them.
- `src/components/ui/`: reusable components (Button, RiskCard, UploadBox, Stepper, EntityField, Dialog...)
- `src/pages/DesignSystem.tsx`: internal page showing every component

## Rules

- No hard-coded colours or text in components; use tokens and translation keys.
- To add a language: add `locales/<code>.json`, an entry in `languages.ts` and a font loader in `fonts.ts`; `npm test` then checks keys and placeholders.
- Result screens show a risk level with reasons, never "100% fake" or an accuracy percentage.

Design: Option A "Calm Trust" (`../../design-mockups/`). Steps: see `../../build-phases/`.
