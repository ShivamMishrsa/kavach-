# Resume bullets: only measured numbers

Every number below was measured in this repository and can be reproduced with the command in the
"Where it comes from" column. **Do not round up, and do not drop the words in brackets**: they are
what makes the claim true. If you change the code, re-run the command and update the number.

## Ready to paste

- Built **Kavach**, a multilingual (7 Indian languages) scam-triage web app and installable PWA
  (React 19, TypeScript, FastAPI, Tesseract) that reads a photo or message and returns a **risk level
  with the reasons**, plus a PDF summary to read to the 1930 cybercrime helpline; privacy by design
  (consent first, checks deleted from memory after 15 minutes, no account needed).
- Measured the detection rules honestly: on a **fresh set of 80 messages written without looking at
  the rules** they warned about **73% (19 of 26)** of the scams they were written for, against 100%
  on the sets they were tuned on; fixed the gaps this exposed and documented every remaining
  weakness, rather than quoting the flattering number. (Synthetic messages written by the team, no
  real data.)
- Found and fixed **real bugs by measurement**: a regular-expression denial of service (20,000
  characters took about 3 s), a crash on links over 500 characters, photo reading on tilted or small
  pictures (wrong characters **41% → 7%** and **14% → 4%** after straightening and enlarging), and
  words disguised with invisible or look-alike letters.
- Wrote **454 backend tests** (63 of them hostile-input and security tests), **183 frontend unit
  tests**, and **138 cross-browser tests** (Chromium, Firefox, WebKit) plus Edge suites against the
  real backend; every browser test also fails on a Content-Security-Policy violation or uncaught
  error. 0 known dependency vulnerabilities at the last audit.
- Cut the landing page's first paint from about **about 1.5 s to about 0.7 s** on a simulated slow phone and
  network (Fast 3G, 4× slower processor) by writing the public pages out as HTML at build time and
  loading only English up front; kept the page under a measured download budget (about 245 KB measured, 255 KB allowed).
- Passed **axe-core accessibility checks (WCAG 2.1 A/AA) with zero violations on 39+ screens**, in
  light, dark, high contrast, largest text and Hindi. (Automated checks find about a third of
  problems; a screen-reader test has not been done.)
- Built **offline support** with a hand-written service worker: the app installs and opens with no
  connection, and a check typed offline is kept on the phone and sent when the connection returns,
  with explicit deletion rules and no background sync.

## Where it comes from

| Claim | Command or file |
|---|---|
| 73% (19/26), 100% on tuned sets, mistakes | `python -m evaluation.run` in `microservices/backend`; `docs/benchmarks.md` (column "Holdout, frozen") |
| 454 backend tests, 63 abuse tests | `pytest -q`; `pytest tests/test_abuse.py -q` |
| 183 unit tests | `npm test` in `microservices/frontend` |
| 138 browser tests | `npx playwright test --list` (46 × 3 engines, 2 skipped by design) |
| ReDoS 3 s, long link crash | the table in `build-phases/08-accuracy-tests-deploy.md` |
| Photo reading 41% → 7%, 14% → 4% | `python -m evaluation.ocr`; `docs/benchmarks.md`, "Photos" |
| 1.5 s → 0.7 s, about 245 KB | `microservices/tests/e2e/run.ps1 -Only perf` (and `docs/decisions/ADR-0004-launch-architecture.md`, decision 11) |
| axe, 39+ screens | `run.ps1 -Only a11y` (41 checks) and `npm run test:browsers` (18 pages) |
| 0 vulnerabilities | `npm audit`, `pip-audit -r requirements.txt` |

## Do not say

- Any accuracy percentage for real messages, "detects scams", or "100% accurate": the product is a
  risk assessment on rules, and no real message has been tested.
- "Deployed", "live" or "users": it is not live and no real person has used it.
- "Production-ready", "secure" or "tested on iPhone and Android": there has been no outside review
  and no real phone.
- "AI-powered": there is no model in the loop (that is a feature, and the honest word).
- That the CI pipeline is green, until you have seen it run on GitHub.
