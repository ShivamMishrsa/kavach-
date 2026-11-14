# ADR-0005: Installable app, offline, and checks kept for later (Step 9)

Status: accepted, 15 Nov 2026

## Context
Many people will meet a scam on a weak or missing connection, with the scammer still on another
phone. The website should install like an app, open with no internet, say clearly what works and
what does not, and not lose a check typed at the wrong moment. At the same time Kavach promises that
nothing is stored: a check lives 15 minutes in the server's memory. This ADR says where those two
meet.

## Decisions

1. **One codebase, installable web app; no native app, no framework for it.** A manifest
   (`public/manifest.webmanifest`), PNG icons (including a maskable one) made from the same shield
   as the favicon (`scripts/make-icons.mjs`), and a hand-written service worker
   (`scripts/sw.template.js`, filled in at build time by `vite.config.ts`). No Workbox: the worker is
   about 80 lines, and the privacy rules below are easier to see and test in 80 lines than in a
   configuration.

2. **What the worker keeps.** At install: the app (every screen's code, English), the styles, the
   Latin fonts, the icons, the manifest and the six public pages. After first use: other languages
   and the fonts for other scripts. Nothing else, and **never the API**: the worker handles only GET
   requests to its own site, and keeps only plain successful answers from it. So a result, a PDF or
   an account is never in a cache. A test reads the worker's source for these rules.

3. **Saving the app on the phone is a background job that waits its turn.** The worker is registered
   after the page has loaded and the phone is idle (`requestIdleCallback`, at most 10 s later), and not
   at all when the person has asked to save data (or the phone says Data Saver is on or the network is
   very slow): the install downloads the whole app once (about 370 KB compressed, measured in the speed
   suite, with its own budget). Those people can turn "Save data" off to get offline use.

4. **Pages from the network first, with a 3.5 second patience, then the saved copy.** A new version
   is therefore never hidden behind an old one for someone who is online, and someone on a bad
   connection gets the saved page after a few seconds, not a spinner for a minute. Files with a hash
   in the name are saved first (they never change). The saved copy is found even though the server
   says `Vary: Origin` (a bug that only showed offline in Chromium).

5. **A new version waits for the person.** The new worker installs but does not take over until the
   person taps "Reload" in a message; the first worker on a fresh visit takes over silently. Nobody
   loses a half-typed message to an update.

6. **Checks kept for later: a deliberate, small exception to "nothing is stored".** When a check
   fails because there is no connection, the notice text, link or photo is kept in the phone's own
   IndexedDB (`src/offline`). The person is told, it is listed on the home screen with "Send now" and
   "Remove", and it is sent by itself when the connection returns **while the app is open**. It is
   deleted when sent, after one hour, when removed, when the person deletes their data and when they
   withdraw consent. At most five. There is **no background sync and no push**: nothing is ever sent
   while the app is closed, so the person always knows when their notice leaves the phone. The server
   still keeps nothing. (A server-side queue was rejected: it would store the notice for longer than
   15 minutes.)

7. **Fail fast, not wait.** The data library (TanStack Query) pauses requests while the phone says it
   is offline, which made a check hang on "Checking" forever. Requests now run with
   `networkMode: 'always'`, so they fail at once with a network error that the screens turn into a
   message or into a saved check.

8. **The first screen is ready before the router starts** (`src/router.ts`, `createAppRouter`; a
   top-level `await` there made the bundler split the app into many more files and cost about 35 KB
   and 20 requests on the landing page, so it is a function) and the main screens are
   fetched when the phone is idle (`src/lib/preload.ts`; a failed fetch is ignored), so the page written out in advance is not
   replaced by a blank, and a phone that loses its connection after opening the app can still go
   home. Skipped when the person is saving data.

9. **Saving data.** "Save data" in Settings (Auto, On, Off; Auto follows the phone's Data Saver and
   slow networks) makes photos smaller before sending (long side 1600 px, JPEG 70%, for files over
   0.4 MB; normally 2400 px, 85%, over 1.5 MB) and asks for the result every 1.5 s instead of 0.7 s.
   The copy that is sent has no camera metadata (no location). **The server's fingerprint is of the
   smaller copy, not of the original photo**, and the screen says a smaller copy is sent. A photo the
   browser cannot decode is sent as it is. Screenshots and PDFs under the limit are never touched.

10. **Share to Kavach.** The manifest registers a share target (`/app/share`, GET), so on Android a
   message or link can be shared from another app into the notice or link check, filled in but not
   sent. The text arrives in navigation state, is read once and removed from the history entry. Not
   done: sharing an image (needs a POST handled by the worker and a stored file). Three home-screen
   shortcuts open the notice check, the link check and the "already sent money?" page.

11. **No voice scan.** The microphone is not used (voice is "coming soon" and out of scope for this
    step).

## Consequences
- A phone that installed the app can open it, read the help and 1930 pages, and (with the demo build)
  run a whole simulated check with no connection. With the real backend a check needs a connection
  and is kept for later otherwise.
- Every deploy produces a new worker (the version includes the build time), so every deploy shows
  the "new version" message once.
- Real-phone behaviour (install, share target, offline on iPhone) is untested: see `docs/phone-test.md`.
- The Edge suites bypass the worker (so a run never sees an older build's files); the Playwright
  `pwa.spec.ts` turns it on and tests it in three browser engines.
