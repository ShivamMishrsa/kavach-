# Step 1: Setup (Roadmap Phase 0)

**Status:** Done

## Goal
Build shuru karne se pehle project ka base aur decisions ready.

## Tasks
- [x] Repo structure: `microservices/{frontend,backend,database,ml,infra,tests}`, `docs/`, `build-phases/`
- [x] Frontend scaffold: React + Vite + TypeScript (`npm run lint` aur `npm run build` pass)
- [x] Backend scaffold: Python venv + FastAPI `/health` endpoint + pytest (1 test pass)
- [x] Tooling: oxlint + Prettier (frontend), `.editorconfig`, pre-commit hook (basic checks: private key, bade files, merge conflict)
- [x] `.gitignore` (node_modules, venv, .env, uploads, keys)
- [x] `.env.example` (frontend aur backend); secrets kabhi repo me nahi
- [x] README: project run karne ke steps
- [x] Decision log: `docs/decisions/ADR-0001-tech-stack.md` (OCR ka final choice Step 4 me)
- [x] Milestones: `build-phases/README.md` ki status table (alag task board abhi nahi)

## Notes
- Pre-commit hook sirf basic checks karta hai; poora secret scanner (jaise gitleaks) baad me add kar sakte hain.
- Pytest ek deprecation warning deta hai (`httpx` -> `httpx2`); abhi ignore, baad me update.

## Deliverables
Chalne wala frontend aur backend, README, decision log.

## Exit criteria
- [x] Frontend dev server (port 5173) aur backend `/health` (port 8000) dono verify kiye gaye.
