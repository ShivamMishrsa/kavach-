# ADR-0003: Evidence summary PDF, consent record and abuse limits (Step 5)

Status: accepted, 14 Nov 2026

## Decisions

1. **fpdf2 + HarfBuzz draws the PDF, not WeasyPrint.** The roadmap named WeasyPrint, but on Windows it needs
   the ~100 MB GTK3 runtime. fpdf2 is plain `pip`, shapes Devanagari correctly with HarfBuzz (checked on real
   Hindi text) and is enough for a one-page summary. Bundled fonts: Noto Sans for Latin, Devanagari (Hindi,
   Marathi), Bengali, Tamil, Telugu and Gujarati (SIL OFL, 12 files, ~1.3 MB), so the PDF works in all seven
   website languages. Only the fonts a document needs are loaded (a PDF takes under 0.3 s). Known quirk of
   fpdf2: text copied out of a Bengali PDF can contain a few control characters; the page looks right.
2. **The website sends the words, the server sends the facts.** All translations live in the website, so it
   sends the headings and sentences (including the summary the person edited). The server fills in the
   confirmed details and the file fingerprints from its own record, so the PDF cannot claim a detail the
   person did not confirm or a fingerprint the server did not record.
3. **The PDF's own fingerprint is returned, not embedded.** A file cannot contain its own hash. The server
   returns the SHA-256 of the exact bytes and the website shows it; the PDF holds the original file's hash,
   the recorded UTC time and the creation time.
4. **Signed, short download link.** HMAC over scan id and expiry, valid 5 minutes and never past the scan's
   own 15 minutes. Any change gives the same `404` as a missing scan.
5. **Consent is logged server-side** (version, time, keyed hash of the IP) next to the choice kept on the
   device. The IP address is never written. The key is `KAVACH_SECRET`; set it in production or hashes change
   at every restart.
6. **Abuse limits are in the app for now:** body size cap (also for streamed bodies), 20 tries per 10 minutes
   per person and action, security headers. CAPTCHA is not added: it costs every honest user a step, so it
   waits until the logs show abuse. A reverse proxy should still cap bodies and, behind it, the client IP must
   be read from a trusted header (Step 8 deploy).
7. **Deletion is a timer as well as a check.** A background sweep removes expired scans (and their PDFs) every
   minute, so nothing lingers while the service is idle.

## Consequences
- The fonts add ~1.3 MB to the repository.
- Rate limits and scans live in one process's memory; more than one worker needs Redis (Step 8).
