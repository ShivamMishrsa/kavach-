# infra/

Where the deploy files live. They are next to what they build, not here:

- API image: `microservices/backend/Dockerfile` and `.dockerignore`
- Website: `microservices/frontend` (`npm run build` writes `_headers`, `_redirects`, `robots.txt`)
- CI: `.github/workflows/ci.yml` (lint, tests, build, dependency audit, Docker build)
- How to run it for real, what to watch, backups: `docs/deploy.md`; why: `docs/decisions/ADR-0004-launch-architecture.md`

Hosting is not chosen: India region preferred (verify price and availability).
