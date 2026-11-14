# Kavach

Multilingual (English default, Indian regional languages) scam-triage web app (mobile-first, then PWA): notice scan, link check, entity extraction and an evidence dossier. Output is a **risk assessment with reasons, not a verdict or legal advice.**

## Repo layout

| Folder | Purpose |
|---|---|
| `microservices/frontend` | React + Vite website / PWA |
| `microservices/backend` | FastAPI backend (modular monolith) |
| `microservices/database` | Schemas, migrations, purge scripts |
| `microservices/ml` | OCR, rules, evaluation experiments |
| `microservices/infra` | Docker, CI/CD, deploy configs |
| `microservices/tests` | Browser end-to-end checks (`e2e/run.ps1`) and cross-module tests |
| `build-phases` | The 9 website build steps (checklists) |
| `design-mockups` | UI mockups (Option A is the chosen design) |
| `docs` | Architecture decisions, user stories, API contract, [benchmarks](docs/benchmarks.md), [deploy runbook](docs/deploy.md), [usability test kit](docs/usability-test.md) |

Planning PDFs (master document, roadmap, microservice architecture) are in the repo root.

## Run locally

Frontend (Node 20+):

```bash
cd microservices/frontend
cp .env.example .env.local
npm install
npm run dev        # http://localhost:5173
npm run lint && npm run build
```

Backend (Python 3.11+):

```bash
cd microservices/backend
python -m venv .venv
.venv/Scripts/activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload   # http://localhost:8000/health
pytest
```

## How well does it work?

Measured on sets the team wrote (no real person's messages), small, with wide uncertainty: see
[`docs/benchmarks.md`](docs/benchmarks.md) for the numbers, what they do not show, and the mistakes
the rules still make. No accuracy figure is claimed for the product.

## Rules

- No secrets in the repo; only `.env.example` files are committed.
- User uploads are never committed or stored beyond the short TTL.
- Claims (accuracy, latency) are published only after they are measured.
