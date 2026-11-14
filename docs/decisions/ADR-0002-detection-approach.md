# ADR-0002: Detection approach for the first real backend (Step 4)

Status: accepted, 13 Nov 2026

## Context
Step 4 replaces the website's simulated results with real ones. The product promise is honesty:
a risk level with reasons, never a verdict or a made-up accuracy number, and as little personal
data kept as possible.

## Decisions

1. **Rules decide the risk; no LLM in this step.** Each signal (digital arrest, payment demand,
   safe account, secrecy, urgency, old law names, look-alike link, insecure link) has a weight and
   the level comes from the total. A person can follow why a result came out as it did, every
   rule has a test, and nothing a scammer writes can talk the system into a lower level. If an LLM
   is added later it may only help word an explanation; it will not set the level.
2. **Tesseract for OCR (English first, then Hindi).** Free, runs on a CPU, no data leaves the
   server. Language order matters: with Hindi first it drops the digit "1". Hindi accuracy is
   average, so Hindi wording is matched on consonants only (vowel signs removed on both sides).
   Photos it cannot read well give `cannot_verify`, not a guess.
3. **Nothing about the person is stored.** The file is read once and dropped. Results and
   confirmed details live in memory for 15 minutes. History (id, kind, level, time) stays on the
   person's device until accounts exist (Step 7); the server cannot know whose history is whose.
4. **One in-memory store, one worker.** Enough for a prototype and simplest to make correct. It
   moves to Redis with the purge job and rate limits in Step 5, when more than one worker is needed.
5. **The website never shows server text.** The server sends codes (`very_high`,
   `digital_arrest`, `invalid_input`); every sentence comes from the translation files.
6. **A UTR is not an Aadhaar number.** A 12-digit number is treated as Aadhaar only when it is not
   labelled as a payment reference and is either labelled as Aadhaar or passes the Verhoeff check.

## Consequences
- Rules miss scripts they were not written for. Step 8 measures precision and recall on a labelled
  set and tunes the weights.
- Old-law notes (IPC to BNS) come from a small table that must be checked against the gazette.
- Real language support is English and Hindi notices; the other five languages only change the
  words around the result.
