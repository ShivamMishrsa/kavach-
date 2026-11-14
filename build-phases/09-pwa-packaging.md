# Step 9: PWA and Packaging (Roadmap Phase 18)

**Status:** Done in code, tested in three browser engines. **Not done:** a test on a real phone (install, share, offline), pushing the repo's "outward" settings (description, topics, license), and anything that needs a live site. Details: `docs/phone-test.md`, "Not done" below.

## Goal
Website ko installable app jaisa banana aur hackathon/resume ke liye package karna.

## Tasks
- [x] **PWA: manifest, icons, service worker, installable**: `public/manifest.webmanifest` (name, standalone, theme, 3 shortcuts, share target), PNG icons (192, 512, maskable 512, iPhone 180) bane Kavach ki shield se (`scripts/make-icons.mjs`, `shrink-icons.py`; **pehle favicon Vite template ka logo tha**), haath se likha service worker (`scripts/sw.template.js`, build me `vite.config.ts` bharta hai: ~80 lines, API ko kabhi nahi chhoota, sirf apni site ki plain GET files). "Install the app" Settings me (Android button, iPhone ke liye words). ADR-0005
- [x] **Offline shell + offline message + retry queue**: app, help, 1930 aur public pages bina internet khulte hain; peela banner batata hai kya chalega (1930 phone call hai, chalega); offline likha hua check phone me IndexedDB me rakha jaata hai, home par "Waiting for a connection" me dikhta hai (Send now / Remove), internet aate hi **app khula ho tab** apne aap jaata hai. Delete: bhejne par, 1 ghante baad, Remove, "Delete all", consent wapas lene par; max 5; **background sync/push nahi** (app band ho to kuch nahi jaata). Naya version "Reload" par hi lagta hai
- [x] **Camera polish, compressed uploads, low-bandwidth mode**: bade photo (>1.5 MB; Save data me >0.4 MB) bhejne se pehle chhote JPEG me (2400 px/85%; Save data me 1600 px/70%), camera metadata (location) hat jaata hai, rotation theek; decode na ho to original jaata hai. **Server ka fingerprint chhoti copy ka hai** (screen par likha). "Save data" Auto/On/Off (Auto = phone ka Data Saver / slow network): poll 1.5 s, preload band, service worker install band. Camera tip (7 bhasha). Mic: voice scan abhi "coming soon", isliye mic nahi
- [x] **Second-phone quick scan**: icon ke shortcuts ("Check", "Link", "Already sent money?"), Android par doosre app se "Share to Kavach" (message ya link bhara hua khulta hai, bheja nahi jaata, history me nahi rehta), icon se result tak **3 actions** (test me). Asli doosre phone par check: `docs/phone-test.md` (**abhi nahi kiya**)
- [x] **Demo**: `docs/demo-script.md` (2 minute, kya bolna, kya click, sawal-jawab, fail hone par), backup video `docs/demo/kavach-demo.webm` (~45 s, captions, asli backend par record; 4.6 MB), offline fallback = installed demo build (simulated, banner batata hai)
- [x] **Sample files**: `samples/` me 6 banawati notice (EN/HI PNG, courier SMS, bank alert, blurry photo, PDF summons), har ek par laal patti "DEMO SAMPLE: FAKE", natija asli pipeline se (`python -m evaluation.samples`)
- [x] **README**: naya root README (kya hai, status, architecture diagram, run, tests, measured numbers, kya nahi hua)
- [x] **Pitch deck**: 12 slides, private Artifact (link `docs/pitch.md`): problem, two phones, privacy, **"Measured, honestly" (73%)**, limits slide, B2B concept (mock, "not built")
- [x] **Resume bullets**: `docs/resume-bullets.md`, har number ke saath command aur "Do not say" list
- [x] **GitHub cleanup (jo mere haath me tha)**: `.gitattributes` (LF, binary types), `SECURITY.md`, README, security/CI. **Nahi kiya**: root par 4 PDF + 4 docx + 2 html (planning files) `docs/planning/` me le jaana, repo description/topics, license (aapka faisla)

## Jo mila aur theek hua (measure/test se)
| Bug / kami | Kaise mila | Theek |
|---|---|---|
| Favicon Vite template ka tha, icons.svg bekaar | icons banate waqt | shield icon, sprite hata diya |
| Offline me check "Checking…" par atka rehta tha | e2e offline | data library offline me request rok deti thi: `networkMode: 'always'` |
| Offline me saved copy Chromium me nahi milti thi | Playwright | server `Vary: Origin` bolta hai, `ignoreVary` |
| Service worker register hi nahi hota tha | Playwright | app `load` ke baad start hota hai, to event miss; ab readyState dekhta hai, idle par |
| Offline jaane par background preload "uncaught error" deta tha | Playwright (flaky) | preload ke errors chup |
| Offline queue ke baad home khulta nahi tha (chunk fetch fail) | e2e | idle me main screens preload |
| Router ka top-level `await` bundle ko tod deta tha (+35 KB, +20 files landing par) | speed suite | function ban gaya (ADR-0005) |
| Blurry photo (sample) par "low risk" scam message ke liye | samples bante waqt | "unclear" ki seema 50 → 60 (115 kharab photos par koi farq nahi, isliye tuned nahi) |
| App home ka "first paint" asal me landing page ka tha | speed suite (control run) | ab galat page chhupa diya jaata hai, numbers imaandaar |
| Purane service worker se e2e puraani build dekh sakta tha | design | CDP suites worker bypass karti hain, Playwright me sirf pwa.spec.ts |
| `HydrateFallback` warning / blank flash | console | pehli screen router se pehle load hoti hai |

## Verified
- Backend: pytest **454**, ruff clean
- Frontend: **183 unit tests**, tsc, oxlint, prettier, build, contrast, `npm audit` (0)
- Playwright (Chromium Pixel 7, Firefox, WebKit iPhone 14): **138** tests (46 x 3; 2 manifest tests sirf Chromium)
- Edge e2e `run.ps1`: demo flow 106, languages 55, perf 7 (landing: ~245 KB measured, 255 KB budget; offline install: ~375 KB measured, 400 KB budget), prerender 38, a11y 41, real backend 35, **offline 18**, accounts 34

## Not done (aur kyun)
- **Asli phone par test nahi** (install, share target, offline, iPhone): `docs/phone-test.md` checklist. Install/offline ke liye `https://` chahiye
- **Image share** (sirf text/link share hota hai): worker me POST + file store chahiye
- **Landing ab thodi bhaari/dheemi**: ~245 KB (pehle 233), first paint ~0.75 s (control ~0.65 s) manifest aur offline code ki wajah se; pre-render se pehle ~1.5 s tha
- **Pitch deck ko maine dekha nahi** (layout check nahi): kholkar dekh lo; link private hai, Share se kholna padega
- **Backup video ~45 s** hai (poora 2 minute 5 MB limit me nahi aata)
- **Voice scan, B2B portal, admin, native app**: is list ke bahar
- Step 8 ke baaki (live URL, usability test, legal/translation review, asli data par accuracy) jaise the

## Exit criteria
- [x] Koi bhi 2 minute me demo samajh sake (script + samples + video + deck)
- [ ] PWA **asli phone** par install ho (browser me install sabit hua; phone par check baaki)
