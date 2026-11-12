# Step 7: Auth and Settings (Roadmap Phase 4 + Phase 10 partial)

**Status:** Not started

## Goal
Guest se kaam chale; optional account aur settings.

## Tasks
- [ ] **Guest mode (default):** bina account scan
- [ ] Signup/login: Google ya email magic link (Supabase Auth Mumbai region ya simple); phone OTP baad me (DLT registration verify)
- [ ] Logout, session expiry, "logout all devices"
- [ ] Guest -> account upgrade (history merge, user ki permission se)
- [ ] Settings: language, **theme (Light default / Dark / Auto)**, text size, high contrast
- [ ] Privacy settings: consents dekhna/withdraw, data export, **account delete**
- [ ] History (opt-in): list, single/all delete
- [ ] Auth security: rate limits, no account enumeration, short-lived tokens, secure cookies
- [ ] Object-level access (user sirf apna result dekhe), unguessable IDs

## Exit criteria
Guest + login + delete account flows tests ke saath pass.
