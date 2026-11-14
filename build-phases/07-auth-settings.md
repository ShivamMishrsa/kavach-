# Step 7: Auth and Settings (Roadmap Phase 4 + Phase 10 partial)

**Status:** Done (email link login; Google login baad me)

## Goal
Guest se kaam chale; optional account aur settings.

## Decisions (aapke jawab)
- Login **apne backend me** (Supabase nahi): FastAPI + SQLite (`data/kavach.db`; deploy par Postgres, Step 8)
- **Google login abhi nahi**: Google Cloud OAuth client aapko banana hoga; tab tak sirf email link
- **History device par; sync opt-in**: account wale user Settings me "mere sabhi devices par rakho" chalu karein to hi server par sirf type, risk level aur time jaata hai (file, text, details kabhi nahi)

## Tasks
- [x] **Guest mode (default)**: bina account scan, pehle jaisa. Guest ke scans ab bhi sirf lambe random address se khulte hain
- [x] **Login / signup ek hi screen par, bina password**: email me one-time link (15 minute, ek hi baar). Link `/auth/verify#token=...` par khulta hai; secret `#` ke baad hai (server logs/referrer me nahi jaata) aur page khulte hi address bar se hata diya jaata hai
- [x] **Session**: random secret `HttpOnly` + `SameSite=Lax` cookie me (production me `Secure`), 14 din. Server par sirf uska SHA-256 (sign-in link ka bhi). Database chori ho jaye to bhi koi sign in nahi kar sakta
- [x] **Logout, "sabhi devices se logout"**, session expiry (14 din)
- [x] **Guest -> account upgrade**: guest ki chuni hui language account me chali jaati hai; device ki purani history account me **sirf permission se** jaati hai (sync chalu karte waqt checkbox "is device par saheji jaanchein bhi jodein")
- [x] **Settings**: language, theme (Light default / Dark / Auto), text size, high contrast (Step 2-3 se) + ab account section
- [x] **Privacy settings**: consent dekhna/withdraw (pehle se), **data export** (JSON download), **account delete** (account, sessions, history, bache hue sign-in links aur chal rahe scans sab hat jaate hain)
- [x] **History opt-in**: sync off = server par kuch nahi; off karte hi server ki history delete
- [x] **Auth security**:
  - rate limit: ek IP se 20 link / 10 min, **ek email par 5 link / ghanta** (kisi ko mail-bomb nahi kar sakte); baaki hamesha chup-chaap, same jawab
  - **account enumeration nahi**: link maangne par jawab hamesha `202 {}` (naya ya purana address, dono)
  - link/session chhote aur ek-baar; galat, istemal ho chuka ya expired link sab ka ek hi jawab (`401`)
  - account badalne wale requests sirf hamari website se (Origin check) + SameSite cookie + CORS me sirf listed origins
  - logs me email, link ya cookie nahi (test se check)
- [x] **Object-level access**: login ke dauran bana scan sirf usi account se khulta hai (doosre ko `404`, jaise scan hai hi nahi); history ki har row `(user, id)` se bandhi hai, doosra user na dekh sakta na badal sakta
- [x] Privacy policy (EN + HI) me accounts ka sach: kya rakhte hain, kitne din, email service ke baare me
- [x] **Email 7 languages me** (sign-in aur email-badalne ki, AI drafts)
- [x] **Inactive account niyam**: 12 mahine (365 din) tak koi sign in na kare to account history samet apne-aap delete (`inactive_account_days`). Ye 12 mahine maine example ke taur par rakhe; badalna ho to ek number hai
- [x] **Email badalna**: naye address par link jaata hai, khulne par hi badalta hai; purane address se naya khaata banega. Kisi ka address maangne par jawab same (koi pata nahi laga sakta)
- [x] **Sign-in ki list** (kab sign in hua, "yeh device" ka nishaan) aur har ek ko alag se khatam karna

## Verified
- Backend: pytest **324**, ruff clean (auth ke 37 tests: link ek baar, expiry, enumeration, rate limits, cookie flags, CSRF/Origin, logout/logout-all, export, delete, history aur scan ownership, SMTP, logs me PII nahi; account ke 17 tests: email badalna, sign-in list, inactive accounts, purani database ka update, 7 languages ke email)
- Frontend: **133 unit tests**, tsc, lint, prettier, build, contrast pass
- Browser e2e `microservices/tests/e2e/run.ps1`: demo flow **105/105**, 6 languages **54/54**, real backend **34/34**, **accounts 33/33** (asli backend par: email link -> language screen -> Hindi, link dobara kaam nahi karta, naye browser me account ki language, sync, check history me aana, bina session ke 404, export, sabhi devices se logout, dobara login, account delete, delete ke baad same email naye sire se)
- Settings (sync dialog) ka phone screenshot dekha

## Not done / honest notes
- **Email bhejne ke liye SMTP service chahiye** (deploy par `KAVACH_SMTP_*`). Development me email `data/outbox.jsonl` me file ban jaati hai (e2e wahi se link padhta hai). Production me bina SMTP ke kuch nahi bhejta. Service ka naam privacy policy me launch se pehle likhna hai.
- **Google login nahi** (aapka faisla). Phone OTP bhi nahi (DLT registration, baad me).
- Cookie `SameSite=Lax` hai, isliye API aur website **same site** par hon (jaise `api.example.in` aur `example.in`). Alag domain par chalane ke liye design badalna padega (Step 8).
- Inactive account hatane se pehle **email se chetavni nahi bhejte** (policy me likha hai). Ye mail service lagne ke baad (Step 8) jodna theek rahega.
- Rate limits aur sessions ka rate-limit state ek process ki memory me hain (Step 8: Redis). Sessions/accounts SQLite me hain, to ek hi server par.
- Consent log abhi bhi file me (90 din retention); DB me nahi le gaya kyunki usse koi fayda nahi tha.
- Sign-in ka naya UI (check-your-email, link kaam nahi kiya, sync dialog) ki native review baaki; naye strings AI drafts hain.
- Sign-in list me device ka naam/browser nahi dikhta (hum user-agent nahi rakhte, kam data); sirf kab sign in hua. "Last seen" bhi nahi.

## Exit criteria
- [x] Guest + login + delete account flows tests ke saath pass (backend 37 tests, browser e2e 29 checks, demo flow ke guest/login/delete checks)
