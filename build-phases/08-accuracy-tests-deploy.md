# Step 8: Accuracy, Tests and Deploy (Roadmap Phases 14, 15, 16)

**Status:** Done in code and measured. **Not live:** the deploy, the usability test and a test on a real phone need you (see "Not done"). Numbers: `docs/benchmarks.md`.

## Goal
Measured numbers, tests, aur live URL.

## Tasks
- [x] **Labelled sets**: dev, test aur (baad me) holdout: 3 sets, 240 items in all (dev 60+20, test 100+30, holdout 80+30) in `backend/evaluation/data/`. **Synthetic: written by the team**, kisi asli insaan ka message nahi. Dev (tuning) aur test (baad me likha, ek baar chalaya) alag. Hindi, English, Hinglish; scams jin ke liye rules bane hain aur jin ke liye nahi; "hard" honest messages (awareness posts, dost ka paisa maangna, deadline wale delivery notes)
- [x] **Holdout set (naya, unseen)**: test set ke baad, rules ke patterns dekhe bina likha aur **ek baar** chalaya (frozen). Natija dev/test se bahut kharab nikla: jin scams ke liye rules bane hain unme 73% (19/26), 7 ko "low risk". Wajah mili, bas coverage ki jagah theek ki (Hindi "video call chalu rakhiye", "warna" wali dhamki, "warrant will be issued", "निगरानी खाता", Hindi credit alert, OTP warning, Aadhaar/PM-Kisan/DGFT links): ab 92% (24/26), 2 miss bache (known). Frozen aur after-fix numbers alag dikhaye hain (`docs/benchmarks.md`)
- [x] **Playwright** (Chromium Pixel 7, Firefox, WebKit iPhone 14): `microservices/frontend/browser-tests`, `npm run test:browsers`: 32 tests x 3 = 96 pass (landing/public pages, demo flow, Hindi, axe 18 pages), har test CSP violation/uncaught error par fail. CI me `browsers` job. Mere sanity test se confirm: inline script ko pakda jaata hai
- [x] **Public pages pre-render**: `npm run build` ke baad 6 public pages finished HTML me (`privacy.html` etc.), English + default look. Landing first paint ~1.5 s se ~0.55 s (Fast-3G, 4x slow CPU), +8 KB download. Dusri language / dark / bada text / dusra address wale ko ye page chhupaya jaata hai (chhoti inline script, CSP me hash se allowed). `tests/e2e/prerender.mjs` 38 checks, `entry-server.test.ts`, `skip-prerender.test.ts`
- [x] **Eval script** `python -m evaluation.run`: recall, false alarms, precision, "low risk" bola gaya scam (sabse buri galti), warned vs strongly warned, 95% confidence interval, exact-match entities, IPC to BNS notes. `tests/test_evaluation.py` har test run me guard lagata hai
- [x] **Photo path** `python -m evaluation.ocr`: message ko image banakar blur / chhota+compressed / tilted / noisy karke OCR + rules; typed text se risk level ka mel
- [x] **Latency (p50/p95) aur cost** `python -m evaluation.latency`: kaam ka time aur poore request ka time, ek aur chaar ek saath. Cost: koi third-party fee nahi; server time ka hisaab `docs/benchmarks.md` me (price "(verify)")
- [x] **Rules ki galtiyan mili aur theek hui**: ye test ke dauran mile asli bugs the (neeche)
- [x] **Security checks** `tests/test_abuse.py` (63 tests): decompression bomb, damaged/booby-trapped files, spoofed types, file-name tricks (path, null, right-to-left override), ReDoS timing, SSRF (link kabhi fetch nahi hota), disguised wording (zero-width, Cyrillic, full-width), nested JSON, path tricks, SQL tricks, mass assignment, crash par kuch leak nahi, proxy header spoofing; IDOR/rate limits/deletion Step 5-7 me. `pip-audit` aur `npm audit`: 0 vulnerabilities
- [x] **Accessibility** axe-core, 41 jagah (visitor pages, app, result, dialogs, consent card; light, dark, high contrast, largest text, Hindi): sab pass
- [x] **Slow network / low-end phone** `perf.mjs`: Fast-3G-jaisa network + 4x slow CPU par landing first paint ~1.5 s, 222 KB. Budget test mein
- [x] **CI** `.github/workflows/ci.yml`: backend (ruff, pytest, pip-audit), frontend (tsc, lint, prettier, tests, build + pre-render, contrast, npm audit), Docker build + health + non-root + ek scan + backup + logs me message text nahi. **GitHub par pehli baar chalega.** Yahan Docker nahi hai, isliye image nahi bani; par container ka kaam (prod mode me start, `/health`, scan, backup, requirements me har import) is machine par `uvicorn` se same flags ke saath chala ke dekha, aur lockfile me Linux binaries hain
- [x] **Deploy files**: `Dockerfile` (+ `.dockerignore`), website `_headers` (CSP) / `_redirects`, `docs/deploy.md` runbook, `ADR-0004`
- [x] **Monitoring**: `/health`, `/metrics` (token ke saath, koi personal data nahi), logs me koi PII nahi. Error tracker jaan-bujhkar nahi (ADR-0004)
- [x] **Cost caps**: roz ke checks ka cap (`503 busy`), per-person limits, body/OCR limits
- [x] **Backups**: `python -m app.tools.backup` (online, checked, 30 din ke baad purane delete), restore test me
- [x] **Usability test kit** `docs/usability-test.md` (5 log, tasks, sheet, SUS). **Chalaya nahi**

## Jo bugs measure karne se mile (sab theek)
| Bug | Kaise mila | Asar |
|---|---|---|
| "warranty" ko "warrant" padhna | test set | video call + warranty = "high risk" |
| "fixed deposit of Rs X" ko "deposit karo" samajhna | test set | bank FD alert = medium |
| `http` ke bina links check nahi hote | test set | `sbi-kyc.xyz/login` bina flag |
| "Sections 420, 406 and 120B IPC" list nahi padhi | test set | BNS note adhoora |
| Video call ke agle vaakya me arrest | dev set | scam miss |
| PNR/AWB number phone number samjha gaya | test set | galat detail |
| **Email redaction regex bahut dheemi (ReDoS)**: 20,000 akshar ka text ~3 s | abuse test | ek bada text server dheema kar sakta tha (Step 5 ka bug) |
| **500 characters se lamba link crash** (scan "failed") | abuse test | asli lambe tracking links se scan fail |
| Server crash par 500 me security headers nahi | abuse test | ab same headers + sirf "server_error" |
| Zero-width / Cyrillic / full-width akshar se wording chhup jaati thi | abuse test | ab pehchani jaati hai |
| File name me right-to-left override | abuse test | ab hata diya jaata hai |
| Tilted/chhoti photo par OCR kharab (41% / 14% galat akshar) | photo eval | seedha + bada karna: 7% / 4% |
| Axe: emergency link ka naam dikhte text se alag, upload inputs ka label nahi, 404 par h1 nahi, banners landmark ke bahar | accessibility | sab theek |
| Ek retention test timing par nirbhar tha | pytest | ab deterministic |

## Verified
- Backend: pytest **454**, ruff clean
- Frontend: **157 unit tests**, tsc, lint, prettier, build, contrast, `npm audit` pass
- Browser e2e `run.ps1`: demo flow 106/106, languages 55/55, perf 6/6, prerender 38/38, a11y 41/41, real backend 35/35, accounts 34/34 (sab CSP ke andar)
- Numbers dekhne ke liye `docs/benchmarks.md`

## Not done (aur kyun)
- **Live URL nahi.** Domain, host aur mail service aapke accounts chahiye. `docs/deploy.md` me poora rasta hai. Docker build aur CI maine chala kar nahi dekhe (is machine par Docker nahi, aur GitHub Actions yahan se nahi dikhta).
- **Usability test (5 log) nahi hua.** Insaan chahiye; kit tayyar hai.
- **Asli phone par test nahi** (Android/iPhone), Firefox/Safari bhi nahi. Browser tests sirf Edge/Chrome (desktop emulation) me.
- **Numbers synthetic sets par hain.** Asli scam notices ya asli photos par accuracy maaloom nahi. Test aur holdout dono ab "unseen" nahi (unme mile gaps theek kiye); agle saaf naap ke liye phir naya set chahiye. Holdout frozen: jin scams ke liye rules bane hain unme 4 me se 1 "low risk" gaya.
- **Photo numbers drawn text par hain**, asli photo (shadow, fold, glare, stamp) mushkil hogi.
- **Awareness messages** ("digital arrest scam hai") aur dost ka paisa maangna ab bhi warned hote hain; kam karne ka tareeka scammer ke liye bypass banta, isliye nahi lagaya (benchmarks me).
- run.ps1 me ek bug mila aur theek hua: real-backend preview ka CSP API ka address nahi jaanta tha, isliye `VITE_API_URL` preview start tak set rakha jaata hai. Pichhle runs ke bache hue headless Edge/preview process agle run ko bigaad sakte hain (e2e se pehle band karo).
- Real-phone test abhi nahi. Playwright set (Chromium/Firefox/WebKit) ab hai aur CI me jud gaya, par WebKit on Linux asli iPhone Safari nahi hai. CDP tests (real backend, accounts, speed) CI me nahi chalte (ADR-0004).
- Postgres/Redis nahi: ek instance ke liye zarurat nahi (ADR-0004 me kab badalna hai).
- Pre-render sirf 6 public pages, sirf English; baaki pages/languages script se bante hain.
- Legal text, translations, native review: pehle jaisa baaki.

## Exit criteria
- [x] Benchmark table repo me (`docs/benchmarks.md`), critical bugs zero (jo mile wo theek)
- [ ] Live URL (aapke accounts ke baad)
