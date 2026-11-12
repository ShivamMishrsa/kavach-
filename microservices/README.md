# microservices/

Kavach ke saare technical folders yahan rahenge, har concern alag.

```
microservices/
├── frontend/   React + Vite website / PWA
├── backend/    FastAPI (modules: scan, auth, consent, reports, rules...)
├── database/   schemas, migrations, seed data, purge/TTL scripts
├── ml/         OCR, rules/eval experiments, dataset metadata
├── infra/      Docker, deploy configs, CI/CD, env templates
└── tests/      end-to-end aur cross-module tests
```

Repo ke root par pehle se ye rehte hain (yahan nahi): `build-phases/` (9 steps), `design-mockups/` (UI images), aur roadmap/architecture PDFs.

## Rules
- Har folder ka apna README aur apni dependencies.
- Secrets kabhi repo me nahi; sirf `.env.example`.
- Modules ke beech sirf API/events se baat; ek module doosre ka database seedha nahi padhega (microservice-ready design).
- Folders abhi khaali (placeholder) hain; code Step 1 se shuru hoga (`../build-phases/01-setup.md`).
