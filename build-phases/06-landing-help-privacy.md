# Step 6: Landing, Help and Privacy Pages (Roadmap Phase 3 + Phase 10 partial)

**Status:** Done (legal text is a draft, not lawyer-reviewed)

## Goal
Public website: landing page aur trust-building pages.

## Tasks
- [x] Landing page `/` (light default, dark button header me): hero + sample result (marked "not a real check"), 4 scam types, 3 steps, privacy section, B2B API teaser, FAQ, footer. Sab 7 languages me
- [x] Landing se seedha rasta: "Check now" -> `/start` (guest / log in / sign up) -> language -> scan. Purana welcome screen ab `/start` par
- [x] Privacy policy, Terms, Limitations: **English + Hindi** (`src/i18n/legal/`); baaki languages me English + ek note. Page ke upar saaf "Draft, lawyer review baaki" notice
- [x] Public Help (`/help`) aur 1930 / cybercrime.gov.in + "paise bhej diye?" checklist (`/emergency`, bina account ke chalta hai; same components jo app me hain)
- [x] Emergency strip har page par (landing, legal, help, 404, 500, maintenance, app)
- [x] SEO basics: har public page ka title + description, app/login/language pages `noindex`, `robots.txt` (build me), `sitemap.xml` (jab `VITE_SITE_URL` set ho), og tags
- [x] 404 / 500 (1930 strip ke saath) aur maintenance page (`VITE_MAINTENANCE=true` build)
- [x] Claims honest: koi % accuracy, "100%" ya "koi competitor nahi" nahi (test se check hota hai). Voice "experimental, baad me", API "Planned, abhi available nahi"
- [x] Consent card se privacy policy ka link (naye tab me)
- [x] Landing ke 3 steps ke chhote chitra (upload, risk level, evidence summary): asli components se bane, isliye har language/theme me sahi dikhte hain
- [x] **Retention 90 din** (aapka faisla): consent aur feedback records ab sach me 90 din baad apne-aap delete hote hain (har ghante check), policy me wahi likha hai
- [x] Server ka apna access log (jisme IP aata hai) code se band; policy me wahi likha hai
- [x] E2E ka ek flaky run: browser ka connection toot jaye ya jawab na aaye to ab saaf `FAIL` line aati hai (pehle script chupchap khatam ho sakti thi); title/noindex checks me timing race theek kiya

## Verified
- Backend: pytest **270**, ruff clean (naye: retention 6 tests)
- Frontend: **115 unit tests** (naye: legal text EN/HI barabar + koi accuracy claim nahi), `tsc`, lint, prettier, build, contrast pass
- Browser e2e `microservices/tests/e2e/run.ps1`: demo flow **105/105**, 6 languages **54/54** (landing phone par fit + koi raw key nahi), real backend **34/34**
- Screenshots dekhe: landing phone, desktop aur dark; privacy page phone

## Not done / honest notes
- **Legal text draft hai.** Contact email/address aur governing court abhi tay nahi (page par likha hai); email aap abhi placeholder rakhna chahte ho. Launch se pehle vakeel review zaroori.
- Hindi/Marathi/aur baaki landing translations AI drafts hain; native review baaki.
- **Search engines ko abhi sirf `index.html` dikhta hai** (SPA). Har page ka title/description JS se set hota hai; Google ye chala leta hai, par pehle-load pre-rendering Step 8 (deploy) me dekhenge.
- Sitemap ke liye asli domain chahiye (`VITE_SITE_URL`); domain tay hone par set karna hai.
- Hosting service ya proxy ke apne connection logs me IP ho sakta hai; policy me likha hai, deploy par kaun se logs aur kitne din tay karna hai (Step 8).
- "Accounts" abhi demo hain; policy me likha hai ki asli accounts se pehle policy badlegi (Step 7).
- Landing par photo ya asli app-screenshot nahi: wo ek hi language me hote aur app badalne par purane ho jaate. Uski jagah live components use kiye. Mockup ka B2B code sample jaan-bujhkar nahi, kyunki API abhi hai nahi.

## References
`design-mockups/Website-1-Landing-Light.png`, `Website-2-Landing-Dark.png`

## Exit criteria
- [x] Landing se scan flow tak seedha rasta (Check now -> Continue without account -> language -> scan), mobile + desktop par sahi
