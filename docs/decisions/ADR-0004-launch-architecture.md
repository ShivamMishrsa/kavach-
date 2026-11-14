# ADR-0004: How Kavach is run at launch (Step 8)

Status: accepted, 14 Nov 2026

## Context
Steps 4 to 7 built the checking, the evidence summary, the pages and the accounts. Step 8 decides
how it runs for real people, and what it costs to keep it safe and cheap. Nothing here needs a
paid service from a particular company; the choices are meant to be easy to move.

## Decisions

1. **One API instance, one worker, SQLite on a persistent disk. No Redis, no Postgres yet.**
   Scans and the rate limits live in the memory of one process on purpose: a scan is never
   written to disk, and "deleted after 15 minutes" is then simple to keep true. Accounts, sessions
   and the synced history are small rows in `data/kavach.db`. A photo check takes about a third of a
   second of one core (see `docs/benchmarks.md`), so one small server is enough for a long time.
   **Move to Postgres and Redis only when one of these is true:** a second instance is needed
   (zero-downtime deploys, or sustained OCR load above about half a core), or the host cannot give
   the API a disk that survives restarts. Moving means: accounts and history to Postgres
   (the SQL in `accounts/store.py` is plain apart from `RETURNING`), rate limits and the daily cap to
   Redis, and scans stay in memory per instance with the person pinned to it.

2. **Website and API on the same site**, for example `kavach.example` and `api.kavach.example`.
   The session cookie is `SameSite=Lax`, so a browser sends it to the API only when both are on the
   same registrable domain. A different domain would need a new cookie design.

3. **Provider-neutral.** The API is a container (`microservices/backend/Dockerfile`) with a mounted
   `/data`. The website is static files (`npm run build`) that a static host serves, with `_headers`
   and `_redirects`. Prices, regions and plans change; look them up when choosing (verify). India
   regions are preferred for latency and data location.

4. **Security headers on both sides.** The API sends `nosniff`, `no-referrer`, `no-store`, and a
   CSP that allows nothing. The website's `_headers` sets a CSP where scripts may only come from the
   site itself, styles may be inline (the toast library adds some), and the page may talk only to the
   API. The browser tests run under the same headers, so a feature that needs more fails them.

5. **Who the caller is.** Behind a reverse proxy the address comes from `X-Forwarded-For`, counted
   from the end by `KAVACH_PROXY_HOPS` (0 = ignore the header). The value a caller sends is never
   trusted, so the per-person limits cannot be dodged by making up an address. The server's own
   access log (which prints addresses) is off, and uvicorn runs with `--no-proxy-headers`.

6. **Cost cap.** `KAVACH_MAX_SCANS_PER_DAY` (10,000 by default) stops new checks for the day for
   everybody when it is used up ("busy", a 503); reading results, signing in and the helpline links
   keep working. The per-person limits, the body size cap and the OCR time limit sit under it. Set the
   host's own budget alert too: this cap counts checks, not money.

7. **Watching it.** `GET /health` for uptime checks; `GET /metrics` (Prometheus text, needs
   `KAVACH_METRICS_TOKEN`, absent otherwise) with counts of checks by outcome and risk level, how long
   they took, refusals and sign-ins. No address, text or id appears in it. There is no third-party
   error tracker: request bodies and stack traces can hold what people sent, so one would have to be
   configured to drop them first.

8. **Backups.** `python -m app.tools.backup --to <folder>` makes a checked online copy of the
   database and the two logs; copies older than 30 days are deleted, so a deleted account is gone
   from backups within 30 days (the privacy policy says this). Restore is tested in the test suite.
   Run it daily from the host's scheduler and keep the copies somewhere that is as protected as the
   live disk and, ideally, in another place.

9. **Two sets of browser tests.** The DevTools-protocol suites (demo flow, seven languages, public
   pages, real backend, accounts, speed, accessibility) run with no extra packages, in Edge or Chrome
   on Windows; they are the only ones that cover the real backend, and the only ones that measure
   speed. Added later: a Playwright set (`microservices/frontend/browser-tests`, `npm run
   test:browsers`) that runs the demo flow, the public pages, Hindi and axe accessibility in
   Chromium (Pixel 7 size), Firefox and WebKit (iPhone 14 size), and in CI (the `browsers` job).
   Both stay: the second is what finds an engine-specific problem, the first is what drives the real
   backend. What is still not covered: no real phone has been used, and WebKit on Linux is not
   Safari on an iPhone (the engine is the same, the platform is not). A phone test over the local
   network is the next thing to do by hand.

10. **The rules decide the level; there is still no model in the loop** (ADR-0002). What the rules
    get right and wrong is measured in `docs/benchmarks.md`, on sets written by the team.

11. **Public pages are written out at build time.** `npm run build` ends with
    `scripts/prerender.mjs`: the six public pages (`src/publicPages.ts`) are rendered in Node with
    React's server renderer and written to the build as `index.html`, `help.html` and so on, in
    English with the default look. The app starts with `createRoot`, which replaces them (no
    hydration, so a page that differs by language or colours cannot mismatch). An inline script
    that hides the page from anyone it is wrong for is allowed by its hash in the CSP rather than by
    `'unsafe-inline'`. Cost: about 8 KB more on the landing page download; gain: the landing page
    paints at about 0.65 s on the slow-phone test instead of about 1.5 s (Step 9 added the manifest and offline code: about 0.75 s, +8 KB; see ADR-0005), and search engines read
    the text. Rejected: a headless browser to take snapshots (needs a browser in the build) and
    hydration (needs identical output on both sides).

## Consequences
- A restart loses scans in progress (15 minutes of data by design) and the rate-limit counters; it
  keeps accounts. Deploys are therefore not zero-downtime.
- Everything that sends or holds personal data is named in the privacy policy: the email service
  (named at launch), backups (30 days), the host.
- The Docker image and the GitHub workflow have not been run on the machine they were written on (no
  Docker there); the first push shows whether they work.
