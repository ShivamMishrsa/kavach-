# Step 4: Minimal Backend: OCR + Rules + Hindi Result (Roadmap Phases 6, 7, 8 minimal)

**Status:** Done (rules are untuned and unmeasured; see notes)

## Goal
Asli detection ka patla slice: notice upload -> risk level + reasons in Hindi.

## Tasks
- [x] FastAPI: scans create / get / confirm details / delete, feedback, `/health`; Pydantic validation, OpenAPI (`/docs`). Paths `/v1/scans...` (contract: `docs/api-contract.md`), history device par (accounts Step 7 me)
- [x] Ingestion: type check **file ke pehle bytes se** (JPEG/PNG/PDF), 10 MB limit, SHA-256 of original, ephemeral in-memory store (file kabhi disk par nahi)
- [x] PII: Aadhaar (label ya Verhoeff check) + PAN redact; **UTR/UPI/phone redact nahi**
- [x] OCR: Tesseract (English + Hindi), PDF text layer ya OCR, unclear photo -> "cannot verify"
- [x] Signals/rules engine: money demand, "digital arrest" + video call, secrecy, urgency, "safe/verification account" (English, Hinglish, Hindi)
- [x] Statutory checker: IPC/CrPC naam pakadna + BNS/BNSS mapping (10 + 3 sections); result me "IPC 420 ab BNS 318(4) hai" dikhta hai
- [x] Entity extraction: UTR, UPI ID, phone, amount, date-time, link
- [x] Link check: look-alike, typo, digit-for-letter, homoglyph, punycode, `@` decoy, http
- [x] Risk levels (5) + "cannot verify"; texts website ki translation files se (server text nahi bhejta)
- [x] LLM: **use nahi kiya** (decision, `docs/decisions/ADR-0002-detection-approach.md`); risk rules decide karte hain
- [x] Frontend ko mock se real API par switch (`VITE_API_URL`; bina uske demo mock)
- [x] Unit tests: rules, PII (UTR bug case), entity extraction, links, statutes, store/15-min deletion, API, real Tesseract
- [ ] Hindi templates ka native review (abhi AI drafts)

## Verified
- Backend: `pytest` **205 tests** pass (real Tesseract tests included), `ruff` clean
- Frontend: **102 unit tests** (19 naye real-client tests), `tsc`, lint, build, contrast pass
- Browser end-to-end `microservices/tests/e2e/run.ps1`: demo flow **83/83**, 6 languages **48/48**, **real backend 29/29** (photo upload -> Tesseract -> Hindi result, reasons, IPC->BNS note, details, evidence summary, SHA-256 equals file's real hash, "Delete now" server se bhi hatata hai)

## Not done / honest notes
- **Rules ko real data par tune/measure nahi kiya.** Precision/recall ka koi number nahi; Step 8 me. Naye scam scripts miss honge aur kuch honest messages flag ho sakte hain ("immediately" jaise words se medium).
- **Hindi OCR average hai** (Tesseract). Saaf screenshot theek, dhundhli/haath ki likhai "cannot verify". Hindi words consonants par match hote hain (matra errors ke liye).
- Hindi/Bengali/etc. translations AI drafts; naya `statutes.line` bhi.
- IPC -> BNS table chhoti hai aur official gazette se **verify** karni hai.
- Link check me official domains ki list chhoti hai (verify); unknown domain "safe" nahi kaha jata, "cannot verify".
- Scans memory me hain: ek worker, restart par chale jaate hain. Rate limits, upload size ko request level par rokna, security headers, purge job Step 5 me. Abhi 15-minute deletion "use hone par" lagta hai (expired scan kabhi padha nahi ja sakta), idle memory sweep nahi.
- Feedback `data/feedback.jsonl` me likhta hai (type + chhota note, scan id). Note me user personal baatein likh sakta hai; Step 5/7 me DB aur retention rule.
- Voice abhi bhi "coming soon".
- Real-backend e2e ke liye machine par Tesseract + `hin`/`eng` files chahiye (`backend/README.md`); warna e2e us hisse ko warning ke saath skip karta hai.
- Real phone/camera, real network (slow 3G), aur large PDFs par test nahi hua.

## Exit criteria
- [x] Frontend + backend end-to-end: notice upload -> Hindi result with reasons
