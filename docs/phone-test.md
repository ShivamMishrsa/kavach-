# Trying Kavach on real phones

Browser tests run in Chromium, Firefox and WebKit (the engine of Safari) with phone-sized windows,
and they have never touched a real phone. This is the checklist for doing that by hand: one Android
phone and one iPhone, about 30 minutes each. Write down what you see; fix what is wrong; tick the
box in `docs/deploy.md` ("A real phone used for a check, a PDF download and a sign-in").

## Setup

- **From a laptop on the same Wi-Fi (no deploy needed):** in `microservices/frontend` run
  `npm run build`, then `npx vite preview --host --port 4173`, and open `http://<laptop address>:4173`
  on the phone. Most phone features that need a secure address (installing the app, the service
  worker, the camera on some phones) only work on `https://` or `localhost`, so this tests the layout
  and the checks but **not** installing or offline. For those, test on the deployed site (needs a
  real domain, `docs/deploy.md`) or use a tunnel you trust.
- **For the real checks:** run the backend too (root README) and build the website with
  `VITE_API_URL=http://<laptop address>:8000`; set `KAVACH_CORS_ORIGINS` to the website's address.

## 1. The second-phone quick scan (the reason this exists)

The situation: someone is on the phone with a scammer on phone A. They pick up phone B and must get a
result **without hanging up**.

- [ ] Phone B: open the site, **Check now**, **Continue without account**, **Continue**: the home
      screen in under 10 seconds on mobile data.
- [ ] Paste a message (or take a photo of the notice with **Take a photo**): result in under 10
      seconds. Count the taps from the home screen to the result: it should be 4 or fewer.
- [ ] The **1930** strip is on every screen and dials when tapped.
- [ ] Installed (see 3): long-press the icon: the shortcuts "Check a notice or message", "Check a
      link", "Already sent money?" appear and open the right screen.
- [ ] From a messaging app: select a message, **Share** → **Kavach**: the notice screen opens with the
      text filled in (Android Chrome, installed app only). A shared link opens the link check.

## 2. The checks

- [ ] A photo from the camera app (a printed made-up notice, e.g. `samples/`) opens, previews and is
      read. A big photo shows "a smaller copy is sent".
- [ ] The photo is not sideways (rotation from the camera is respected).
- [ ] A PDF from the phone's files opens and is read.
- [ ] The result screen: nothing cut off at the sides, text readable, buttons reachable with a thumb.
- [ ] **Create evidence summary**, then download the PDF: it opens in the phone's PDF viewer. Hindi
      text in it is shaped correctly.
- [ ] Copy / share the helpline script works.
- [ ] Rotate the phone: the layout does not break.
- [ ] Largest text size (phone setting and the app's own): nothing overlaps.

## 3. Install and offline (needs `https://`)

- [ ] Android Chrome: **Settings → Install the app** shows the button; after installing, the icon is
      the blue shield (not a screenshot or a letter), and the app opens full screen with no browser bar.
- [ ] iPhone Safari: **Settings → Install the app** shows the Share → Add to Home Screen words; the
      icon is the blue shield.
- [ ] Open the installed app, then turn on airplane mode, then open it again: the home screen opens, the
      yellow "No internet" bar shows and the 1930 link is there.
- [ ] Paste a message and check while offline: it says it was saved; the home screen lists it under
      "Waiting for a connection". Turn the connection on with the app open: it is sent, a message says
      so, and the list is empty.
- [ ] Open a language you used before while offline: it still shows in that language.
- [ ] After a new version is deployed: the "A new version is ready" message appears, **Reload** works.

## 4. Languages

- [ ] Each of the seven languages: the home screen and a result read properly, with the right letters
      (no boxes), nothing cut off. Ask a native speaker to read the result screen: that is the
      translation review that is still pending.

## 5. Weak network

- [ ] Phone's Data Saver on (Android): **Settings → Save data** shows "Auto" working; a 4 MB photo
      uploads in a reasonable time.
- [ ] Walk to a spot with one bar of signal and run a check. Note the time. If it fails, the message
      is clear and the person can try again.

## Record what you found

| Phone / browser | What worked | What did not | Fixed? |
|---|---|---|---|
| | | | |
