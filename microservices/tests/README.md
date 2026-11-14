# tests/

Unit tests live next to the code (`microservices/frontend`, `microservices/backend`). This folder holds the checks that need a real browser.

## Browser end-to-end checks (`e2e/`)

Drive production builds of the website in headless Edge/Chrome over the DevTools protocol (no extra packages; `cdp.mjs` holds the small shared helpers).

```powershell
powershell -File microservices/tests/e2e/run.ps1
```

| Script | What it checks |
|---|---|
| `flow.mjs` | The whole English demo flow on the in-browser mock: guest start, language, consent, pasted-text scan, progress, result, feedback, details, evidence summary, history, link check, expiry, checklist, help, settings, log in / sign up / delete account, 404, desktop layout |
| `languages.mjs` | For each regional language (demo): the app opens in that language, no raw translation keys on screen, the result and evidence summary work, 1930 is reachable |
| `backend.mjs` | Against the **real backend**: a photo of a fake notice is uploaded, read by Tesseract and judged by the rules, and the result, reasons, old-law note, details and evidence summary are shown in Hindi; the fingerprint equals the file's real SHA-256; "Delete now" really removes the scan on the server; a bank alert is low, a look-alike link is high |

`run.ps1` runs the demo checks first, then the real-backend check. The real-backend check is **skipped with a warning** when the backend's virtual environment or Tesseract (English + Hindi) is not set up; see `microservices/backend/README.md`.

Screenshots are saved to the output folder (default `%TEMP%\kavach-e2e`).
`languages.mjs` also accepts `PREFS` (a JSON theme/text-size setting) and `PREFIX` environment variables to capture dark mode or large text.

Windows only for now (the runner is PowerShell). Planned: move to Playwright in Step 8.

## Still to add (Step 8)

Accuracy evaluation set, load and abuse tests, deletion verification under load, Hindi PDF rendering.
