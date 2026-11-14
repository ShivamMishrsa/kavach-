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
- `src/api/`: API contract (`types.ts`), TanStack Query hooks (`queries.ts`), the **real backend client** (`http.ts`, with the device-side `history.ts`) and the in-browser **mock backend** (`mock/`). The app only talks to `client.ts`, which picks the real client when `VITE_API_URL` is set and the mock otherwise.
- `src/auth/`, `src/consent/`: demo session (guest or account) and versioned consent
- `src/layouts/`: public site layout (landing, help, 1930, legal), first-run layout, app shell (bottom nav on phones, side nav on desktop), the root layout that sets page title and `noindex`, and route guards
- `src/pages/`: one file per screen (Landing, Welcome, Legal, Maintenance, Home, ScanNotice, ScanLink, ScanView, ScanDetails, Dossier, SentMoney, History, Help, Settings, ...)
- `src/components/`: shared components; `components/ui/` holds the design-system building blocks
- `src/routes.tsx`: all routes (pages load lazily). Public pages (`/`, `/help`, `/emergency`, `/privacy`, `/terms`, `/limitations`) give their title in `handle` and are indexable; every other page is `noindex`.
- `src/i18n/legal/`: privacy policy, terms and limitations. English and Hindi only; other languages see English with a note.
- Build options: `VITE_SITE_URL` writes `sitemap.xml` (and its line in `robots.txt`); `VITE_MAINTENANCE=true` builds a site that shows only the maintenance page.
- `src/pages/DesignSystem.tsx`: internal page at `/design` showing every component

## Rules

- No hard-coded colours or text in components; use tokens and translation keys.
- To add a language: add `locales/<code>.json`, an entry in `languages.ts` and a font loader in `fonts.ts`; `npm test` then checks keys and placeholders.
- Without `VITE_API_URL` the results are simulated and the UI shows a demo notice (`isMockApi`). With it (copy `.env.example` to `.env.local`, start `microservices/backend`) the results are real.
- Result screens show a risk level with reasons, never "100% fake" or an accuracy percentage.

Design: Option A "Calm Trust" (`../../design-mockups/`). Steps: see `../../build-phases/`.
