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
- `src/api/`: API contract (`types.ts`), TanStack Query hooks (`queries.ts`) and the in-browser **mock backend** (`mock/`). The app only talks to `client.ts`.
- `src/auth/`, `src/consent/`: demo session (guest or account) and versioned consent
- `src/layouts/`: first-run layout, app shell (bottom nav on phones, side nav on desktop) and route guards
- `src/pages/`: one file per screen (Welcome, Home, ScanNotice, ScanLink, ScanView, ScanDetails, Dossier, SentMoney, History, Help, Settings, ...)
- `src/components/`: shared components; `components/ui/` holds the design-system building blocks
- `src/routes.tsx`: all routes (pages load lazily)
- `src/pages/DesignSystem.tsx`: internal page at `/design` showing every component

## Rules

- No hard-coded colours or text in components; use tokens and translation keys.
- To add a language: add `locales/<code>.json`, an entry in `languages.ts` and a font loader in `fonts.ts`; `npm test` then checks keys and placeholders.
- Results are simulated until the backend exists (Step 4). The UI shows a demo notice for as long as `isMockApi` is true.
- Result screens show a risk level with reasons, never "100% fake" or an accuracy percentage.

Design: Option A "Calm Trust" (`../../design-mockups/`). Steps: see `../../build-phases/`.
