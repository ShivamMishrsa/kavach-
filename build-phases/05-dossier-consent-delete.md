# Step 5: Dossier PDF + Consent + Auto-delete (Roadmap Phase 9 + Phase 5 basic)

**Status:** Done (PDF 7 languages me; limits ek process ke liye)

## Goal
Evidence dossier, versioned consent, aur 15-minute deletion jo sach me kaam kare.

## Tasks
- [x] PDF template: **WeasyPrint ki jagah fpdf2 + HarfBuzz** (WeasyPrint ko Windows par ~100 MB GTK runtime chahiye). Hindi shaping asli text par check ki, Noto Sans fonts (OFL) **7 languages ke liye** bundled (Devanagari, Bengali, Tamil, Telugu, Gujarati + Latin), **koi sarkari logo nahi** (`docs/decisions/ADR-0003-pdf-and-abuse-limits.md`)
- [x] Sirf user-confirmed facts: details server ke confirmed record se aati hain; bina confirm kiye PDF nahi banta. User apna summary edit kar sakta hai (wo PDF me jaata hai)
- [x] Evidence hash table: original file SHA-256 (server ka record) + UTC time. **PDF ka apna SHA-256** response me aata hai aur screen par dikhta hai (file apna hash khud me nahi rakh sakti)
- [x] "Original file apne phone me rakhein" instruction PDF me aur screen par
- [x] 1930 script PDF me (confirmed facts se, user ki language me). Script ab chhote vaakyon se banti hai: jo detail confirm nahi hui wo vaakya hi nahi aata (pehle "उपलब्ध नहीं को मैंने…" jaisa awkward text aata tha)
- [x] Disclaimer: "user-prepared summary, FIR nahi"
- [x] Signed temporary download URL (HMAC, 5 minute, scan ki life se zyada nahi; galat/badla/expired link = 404)
- [x] Versioned consent: version + time + **HMAC'd IP** server par log hota hai; IP kabhi nahi likha jaata
- [x] 15-minute purge: background sweep har minute + har use par; PDF bhi saath hatta hai. **Deletion tests:** upload disk par kabhi nahi (spool copy bhi hati), expiry ke baad result/details/PDF sab memory se gaye, idle service me bhi sweep se gaye
- [x] Logs me koi PII nahi (poora flow chala kar test kiya)
- [x] Feedback note: warning screen par pehle se thi; ab **server bhi** note se Aadhaar, PAN, email, phone, UPI id aur UTR hata kar likhta hai
- [x] Basic security: body size cap (streamed bodies ke liye bhi), rate limit (20 per 10 min, har action alag, IP hashed), security headers (nosniff, no-referrer, no-store, CSP), prod me API docs band
- [x] CAPTCHA: **abhi nahi lagaya** (decision: pehle abuse dikhe tab; ADR-0003)

## Verified
- Backend: `pytest` **264 tests** pass, `ruff` clean
- Frontend: **112 unit tests**, `tsc`, lint, build, contrast pass
- Browser e2e `microservices/tests/e2e/run.ps1`: demo flow **83/83**, 6 languages **48/48**, real backend **34/34** (consent record, photo -> Hindi result, PDF download, shown fingerprint == downloaded file ka SHA-256, "Delete now" server se bhi hatata hai)
- PDF Hindi, Bengali, Tamil, Telugu aur English screenshot me dekhe (matras, conjuncts, ₹, lambi link sab theek); har PDF 0.3 second se kam me banta hai

## Not done / honest notes
- Bengali PDF se text copy karo to kuch vowel signs control characters ban jaate hain (fpdf2 ki limitation); page dekhne/print karne par sahi hai.
- **Rate limit aur scans ek process ki memory me hain:** ek worker. Zyada workers ke liye Redis (Step 8). Reverse proxy ke peeche asli client IP trusted header se lena hoga (Step 8 deploy).
- **`KAVACH_SECRET` production me fix set karna hai**; warna har restart par links aur IP hashes badal jaate hain.
- Consent log abhi flat file (`data/consent.jsonl`); DB aur retention rule Step 7 me. Consent ka server record best-effort hai (offline ho to sirf device par rehta hai).
- Feedback note me free text (jaise naam) hat nahi sakta; sirf numbers, ids aur email hatte hain.
- PDF ka layout ek page ka simple summary hai; asli police/portal ke format se match karna legal review ke baad.
- Hindi/Marathi/aur baaki translations AI drafts hain; naye keys (PDF button, rate-limit message, 1930 script ke vaakya) bhi.
- Fonts repo me ~1.3 MB badhate hain.

## Exit criteria
- [x] Dossier PDF sahi bane (Hindi render), hash verify ho, TTL ke baad file delete verified
