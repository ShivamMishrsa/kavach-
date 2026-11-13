# Step 3: Mobile-first Screens on Mock Data (Roadmap Phase 1 light + Phase 3)

**Status:** Done (results are simulated; see notes)

## Goal
Poora citizen flow, asli app jaisa, mock data par chalta hua, backend ke bina.

## Tasks
- [x] User stories aur screen map: `docs/product/user-stories.md`
- [x] Routing (lazy-loaded pages) + layouts: first-run layout, app shell (phone par bottom nav, desktop par side nav, skip link), route guards
- [x] **First-run flow:** Welcome (Continue without account / Log in / Sign up) -> Choose language -> app. English default; guest mode rahega
- [x] Log in / Sign up screens (passwordless email link, **demo only**; real auth Step 7)
- [x] Language saved: account ke profile me, guest ke browser me; guest sign up kare to apni language banaye rakhta hai
- [x] Per-language capability label (language picker me, aur notice screen par "scan limited" note)
- [x] Screens: Home, Notice/message (photo/file + paste text + demo samples), Link check (+ demo links), Voice (coming soon, honest), Scan progress + Result, Review details (confirm / edit / add), Evidence summary, "Already sent money?" checklist, History, Help/FAQ, Settings, 404, error screen
- [x] Consent card (versioned) jo pehle upload se pehle aata hai; Settings me withdraw
- [x] Upload: drag-drop, file chooser, camera input, type/size check, image preview
- [x] Result: risk level + reasons, "What to do now", 1930 button, Warn family (share/copy, bina file), "Result looks wrong?" feedback dialog, deletion time + Delete now
- [x] Evidence summary: user-confirmed details, **asli SHA-256** fingerprints (browser me bane), "keep your originals", 1930 script (copy), PDF button honest ("coming next")
- [x] Mock API layer: in-browser mock jo final contract jaisa behave karta hai (stages time ke saath, **15-minute deletion**, history me sirf metadata). Contract: `docs/api-contract.md`. **MSW use nahi kiya**, in-memory mock hai
- [x] Responsive: phone (390 px) aur desktop (1280 px) par dekha
- [x] Loading, empty, error, expired, not-found states; error messages har supported language me
- [x] Voice screen: "coming soon", fake result nahi

## Verified
- `npm test`: **83 unit tests** pass (mock backend, text/link analysis, auth + consent logic, checklist, har language ke keys/placeholders, code me use hui har translation key English me maujood)
- `npm run lint`, `tsc`, `npm run build`, `npm run check:contrast`: sab pass
- **Browser end-to-end:** `microservices/tests/e2e/run.ps1` -> English flow **83/83**, 6 regional languages ke flow checks pass (home, scan, result, details, evidence summary, 1930)
- Screenshots dekhe: welcome, home, result, evidence summary (English), Hindi / Tamil result, dark theme, bada text + high contrast, desktop

## Not done / honest notes
- **Saare results simulated hain.** Notice upload par result file ke hash se tay hota hai, pasted text/link par simple rules lagte hain. Result screen par "Demo result" notice dikhta hai. Asli detection Step 4 me.
- **Translations (Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati) AI-written drafts hain**, native review baaki. Naye screens ke strings (FAQ, checklist, risk advice, evidence script) bhi.
- Help FAQ ka "police video call par arrest nahi karti" wala jawab official advisories (MHA/PIB/I4C) se **verify** karna baaki hai.
- Log in / Sign up sirf demo hai: koi email nahi jata, koi password/OTP nahi.
- "Delete account" abhi sirf is device ka session/profile/history hata deta hai.
- PDF download abhi nahi (Step 5); evidence summary copy kiya ja sakta hai.
- Tablet size alag se test nahi hua. Real phone (camera, share sheet) par test nahi hua. Real screen reader se test nahi hua.
- Browser tests Windows + Edge/Chrome par chalte hain; Playwright par move karna Step 8 me.

## References
`design-mockups/Website-3-WebApp-Scan-Result.png`, Option A mobile screens.

## Exit criteria
- [x] Sab screens mock par chalte hain, phone aur desktop dono par
- [x] Pura flow guest start se evidence summary tak, 7 languages me
