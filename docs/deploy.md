# Deploying Kavach

A runbook for putting Kavach on a real address. It does not name a company: any host that can run
a container with a persistent disk, and any static host, will do. **Look up prices, regions and
limits when you choose (verify).** The reasons for the choices are in
[ADR-0004](decisions/ADR-0004-launch-architecture.md).

**Not done from this machine:** the live deploy, the Docker build and the GitHub workflow. They
need accounts and a domain that only you can create; the first run will show what needs fixing.

## What you need first

| Thing | Notes |
|---|---|
| A domain | Both the website and the API must be on the same site, for example `kavach.example` and `api.kavach.example` (the sign-in cookie is `SameSite=Lax`) |
| A host for the API | Runs a container, keeps a disk (`/data`) between restarts, one instance only. India region preferred (verify) |
| A static host for the website | Serves `dist/`, reads `_headers` and `_redirects` (Cloudflare Pages and Netlify do; for another host copy the rules) |
| A mail service for sign-in emails | Anything with SMTP. Choose one, then name it in the privacy policy before launch |
| A place for backups | Off the API's own disk |
| Someone to read the translations | The non-English text is a draft. So is the legal text: a lawyer must read it (see the notes in `build-phases/06` and `07`) |

## 1. The API

Build and run the image (from the repository root):

```bash
docker build -t kavach-backend microservices/backend
docker run -d --name kavach -p 8000:8000 -v kavach-data:/data --env-file kavach.env kavach-backend
```

Settings, in the host's environment (never in the image or in git):

| Variable | Value |
|---|---|
| `KAVACH_ENV` | `prod` (set by the image). Turns on `Secure` cookies and the strict CSP, and turns off the API docs |
| `KAVACH_SECRET` | A long random value: `python -c "import secrets; print(secrets.token_hex(32))"`. **Keep it fixed**: a new one invalidates PDF links and the hashed addresses in the consent log |
| `KAVACH_DATA_DIR` | `/data` (set by the image). The disk that survives restarts |
| `KAVACH_CORS_ORIGINS` | The website's origin, `https://kavach.example` (comma-separated for more). Also the only origins allowed to change an account |
| `KAVACH_SITE_URL` | The website address, `https://kavach.example`: sign-in links in emails point there |
| `KAVACH_SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD`, `KAVACH_MAIL_FROM` | The mail service. Without these nothing is sent in production |
| `KAVACH_PROXY_HOPS` | How many reverse proxies sit in front of the API and add to `X-Forwarded-For`: `1` for one, `0` for none. A value too low makes every visitor look like the proxy (they then share one limit); one too high lets a caller pick their own address |
| `KAVACH_MAX_SCANS_PER_DAY` | The cost cap on checks per day (default 10000, 0 = none) |
| `KAVACH_METRICS_TOKEN` | Enables `/metrics`. A long random value |

Put TLS in front (the host's load balancer or a proxy). **Run one instance.** Check
`https://api.kavach.example/health`: it must say `"ocr": "ready"`.

## 2. The website

```bash
cd microservices/frontend
npm ci
VITE_API_URL=https://api.kavach.example VITE_SITE_URL=https://kavach.example npm run build
```

Upload `dist/`. It contains `_headers` (security headers, including the CSP that names the API),
`_redirects` (every address opens the app), `robots.txt`, `sitemap.xml`, and the six public pages
written out as finished HTML (`index.html`, `help.html`, `emergency.html`, `privacy.html`,
`terms.html`, `limitations.html`; the build does this, see "Public pages" below). Check:

- `https://kavach.example/privacy` opens directly and "view source" shows the policy text (the
  host serves `privacy.html` for `/privacy`);
- `https://kavach.example/app/history` (or any address that is not one of the six) still opens the
  app, and shows nothing of the landing page while it starts;
- the response has `Content-Security-Policy` (the host reads `_headers`), and `/sw.js` is sent with
  `Cache-Control: no-cache` while `/assets/*` is sent as immutable;
- the app installs (Chrome: an install icon or "Install the app" in Settings; the site must be on
  `https://`, a service worker and a manifest do not work on plain `http://`), and after one visit it
  opens with the connection off;
- a check goes through, a sign-in email arrives and its link signs in, the PDF downloads.

To show only a maintenance page: build with `VITE_MAINTENANCE=true` and upload that.

### Public pages

`npm run build` ends with `scripts/prerender.mjs`, which renders the six public pages in Node and
writes them out in English with the default look, so a search engine, a link preview or a phone on a
slow network gets the text before any script runs. The app then takes over in the browser. A small
inline script in each page (named by hash in the Content-Security-Policy; nothing else inline is
allowed) hides the written-out page from anyone who would see something else: another saved
language, dark colours, larger text, high contrast, or a different address. Only these six pages are
written out; the rest of the site, and every other language, are drawn by script as before. A
maintenance build (`VITE_MAINTENANCE=true`) writes nothing out. Turn on "HTTPS only" and HSTS at the
host: the pages do not set it themselves.

## 3. Watching it

- Uptime check on `/health` (every minute). Alert on three failures in a row.
- `/metrics` with `Authorization: Bearer <token>`: scrape every minute. Useful alerts:
  `kavach_http_responses_total{status="5xx"}` rising, `kavach_scans_total{status="failed"}` rising
  (Tesseract trouble), `kavach_busy_total` above zero (the cap was hit), `kavach_rate_limited_total`
  jumping (someone is hammering), `kavach_scan_seconds` buckets moving right (overload).
- Logs go to the host's log viewer. They hold no addresses, texts or emails (a test checks this).
- Set the host's own spending alert. The daily cap counts checks, not money.

## 4. Backups

Run daily from the host's scheduler, in the container or against the mounted disk:

```bash
python -m app.tools.backup --to /backups --keep-days 30
```

Copy `/backups` to a second place. Copies older than 30 days are deleted, which is how deleted
accounts leave the backups. Restore (stop the API first):

```bash
python -m app.tools.backup --restore /backups/kavach-backup-<time> --into /data --force
```

Try a restore on a spare machine once before launch.

## 5. Before the first real user

- [ ] Legal text read by a lawyer; contact address and the mail service named in the privacy policy
- [ ] Translations read by native speakers (all but English; the legal text is English and Hindi)
- [ ] The usability test (`usability-test.md`) done with five people, and what it found fixed
- [ ] A real phone used for a check, a PDF download and a sign-in (Android and iPhone); the checklist is `phone-test.md`
- [ ] The app installed on a real Android phone and an iPhone, and opened offline
- [ ] `KAVACH_SECRET`, SMTP and metrics settings are in the host, not in git
- [ ] A restore from a backup tried
- [ ] A day-one budget alert set at the host
- [ ] The `main` branch's CI is green (backend, frontend, browsers, docker jobs)

## Not done (and why)

- **Pre-rendering in other languages**, and of the app screens: not needed to launch.
- **Postgres and Redis**: not needed with one instance; the triggers for moving are in ADR-0004.
- **An error tracker**: it would receive what people sent unless configured not to.
- **Real-phone tests**: Firefox and WebKit (Safari's engine) run in CI with Playwright; a real Android and iPhone do not. See ADR-0004.
