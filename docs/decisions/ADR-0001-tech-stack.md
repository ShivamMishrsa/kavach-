# ADR-0001: Initial tech stack

Status: accepted. Date: 2026-11-13.

| Area | Decision | Reason |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast builds, PWA-ready, resume-friendly |
| UI design | Option A "Calm Trust" (light default, dark option) | Chosen by the product owner; see `design-mockups/` |
| Languages | Hindi first, English toggle | Target users |
| Backend | FastAPI (Python), modular monolith | Python ML ecosystem; easy to split later |
| Lint/format | oxlint + Prettier (frontend), pytest (backend) | Vite template default plus Prettier |
| OCR | Tesseract (hin+eng) or PaddleOCR on CPU | Free; decided in Step 4 after testing |
| PDF | WeasyPrint | Correct Devanagari shaping |
| Hosting | India region preferred | Data residency; verify price/availability |
| Scope order | Notice scan, entities, link check, dossier first; voice later | Voice accuracy is the riskiest part |

Consequences: modules are kept separate so services can be split later (see the microservice architecture PDF).

## Addendum (Step 2)

- Styling: Tailwind CSS v4 with CSS-variable design tokens (`src/styles/tokens.css`).
- Components: built in the shadcn/ui style (Radix primitives + class-variance-authority + `cn`), **without running the shadcn CLI**, to keep the component set small and fully token-driven.
- Fonts: Fontsource packages (self-hosted), so no request goes to a font CDN.
- Tests: Vitest for unit tests; a Node script checks colour contrast.
