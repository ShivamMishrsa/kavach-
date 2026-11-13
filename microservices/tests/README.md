# tests/

Unit tests live next to the code (`microservices/frontend`, `microservices/backend`). This folder holds the checks that need a real browser.

## Browser end-to-end checks (`e2e/`)

Drive the production build in headless Edge/Chrome over the DevTools protocol (no extra packages).

```powershell
powershell -File microservices/tests/e2e/run.ps1
```

| Script | What it checks |
|---|---|
| `flow.mjs` | The whole English flow: guest start, language, consent, pasted-text scan, progress, result, feedback, details, evidence summary, history, link check, expiry, checklist, help, settings, log in / sign up / delete account, 404, desktop layout (83 checks) |
| `languages.mjs` | For each regional language: the app opens in that language, no raw translation keys on screen, the result and evidence summary work, 1930 is reachable |

Screenshots are saved to the output folder (default `%TEMP%\kavach-e2e`).
`languages.mjs` also accepts `PREFS` (a JSON theme/text-size setting) and `PREFIX` environment variables to capture dark mode or large text.

Windows only for now (the runner is PowerShell). Planned: move to Playwright in Step 8.

## Still to add (Step 8)

Accuracy evaluation set, load and abuse tests, deletion verification against the real backend, Hindi PDF rendering.
