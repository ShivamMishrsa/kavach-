# Step 5: Dossier PDF + Consent + Auto-delete (Roadmap Phase 9 + Phase 5 basic)

**Status:** Not started

## Goal
Evidence dossier, versioned consent, aur 15-minute deletion jo sach me kaam kare.

## Tasks
- [ ] WeasyPrint HTML/CSS template (Hindi fonts, clean layout, **koi sarkari logo nahi**)
- [ ] Sirf user-confirmed facts; user edit kar sake
- [ ] Evidence hash table: original file SHA-256 + dossier hash + UTC timestamp
- [ ] "Original file apne phone me rakhein" instruction
- [ ] 1930 ke liye Hindi complaint script (confirmed facts se)
- [ ] Disclaimer: "user-prepared summary, FIR nahi"
- [ ] Signed temporary download URL
- [ ] Versioned consent (notice version, timestamp, HMAC'd IP)
- [ ] 15-minute TTL purge job + **deletion test** (file sach me gayi)
- [ ] Logs me koi PII/transcript nahi
- [ ] Basic security: upload limits, rate limits, security headers, CAPTCHA (if needed)

## Exit criteria
Dossier PDF sahi bane (Hindi render), hash verify ho, TTL ke baad file delete verified.
