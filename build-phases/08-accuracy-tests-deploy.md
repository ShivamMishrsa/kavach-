# Step 8: Accuracy, Tests and Deploy (Roadmap Phases 14, 15, 16)

**Status:** Not started

## Goal
Measured numbers, tests, aur live URL.

## Tasks
- [ ] Sample dataset: 50-100 notices (real/realistic + synthetic labeled), dummy payment screenshots
- [ ] Eval script: precision/recall, false-positive rate on real notices, entity exact-match
- [ ] Latency (p50/p95) aur cost per scan **measure** karna
- [ ] Usability test: 5 real users (senior-citizen helpers)
- [ ] Tests: unit, API, E2E (Playwright), mobile viewport
- [ ] Security checks: upload exploits, IDOR, rate limits, deletion verification
- [ ] Accessibility check, slow network/low-end phone
- [ ] Deploy: frontend (Vercel/Cloudflare Pages), backend (Render/AWS Mumbai) **(verify price/availability)**
- [ ] CI: lint + tests + build
- [ ] Basic monitoring, error tracking, cost caps
- [ ] Backups (agar DB use ho)

## Exit criteria
Benchmark table README me, live URL, critical bugs zero.
