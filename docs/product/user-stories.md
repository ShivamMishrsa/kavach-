# Kavach: user stories and screen map (Step 3)

## Who uses it

| Persona | Situation | What they need |
|---|---|---|
| **Victim in panic** | Someone on a video call says "you are under digital arrest" and sent a notice | An answer in minutes, in their language, and what to do next |
| **Family helper** | A parent got a scary message and called them | Check it from their own phone without an account, then warn the family |
| **Cautious user** | Got a strange link, SMS or payment screenshot | Quick check and a clear reason |
| **Already paid** | Sent money a few minutes ago | A checklist for the first hour and a ready evidence summary for 1930 |

## User stories

| # | Story | Acceptance |
|---|---|---|
| 1 | As a victim I can check a notice photo without making an account | Welcome -> "Continue without account" -> language -> upload -> result |
| 2 | As a user I pick my language once and the whole app switches | Language screen after the first choice; saved on the device |
| 3 | As a user I understand what happens to my file before uploading | Consent card with 3 plain points; upload is locked until I agree |
| 4 | As a user I see progress while the check runs | Stepper with real stage names, never a fake percentage |
| 5 | As a user I get a risk level with reasons, not a verdict | Risk card, reasons, disclaimer, "result looks wrong" |
| 6 | As a user I know what to do next | "What to do now" list per risk level, 1930 button always visible |
| 7 | As a family helper I can warn relatives | "Warn family" shares a short message without the file |
| 8 | As someone who already paid I get a first-hour checklist | Checklist with progress saved on the device |
| 9 | As a user I can review and correct extracted details | Edit UTR, UPI ID, phone, amount, time before any report |
| 10 | As a user I get an evidence summary and a script to read to 1930 | Summary with file hashes and a copyable script; PDF comes in Step 5 |
| 11 | As a user I can see and delete my history, withdraw consent, delete my account | History, Settings, delete confirmations |
| 12 | As a user with low vision I can enlarge text and raise contrast | Settings; works on every screen |

## Screen map

```
Welcome (first run) ── Sign up ──┐
        ├── Log in ──────────────┼──> Choose language ──> App
        └── Continue as guest ───┘

App (bottom nav on phone, side nav on desktop)
  Home ── Notice / screenshot / pasted text ─┐
       ├─ Link check ────────────────────────┼─> Scan (progress -> result)
       ├─ Voice note (coming soon)           │        ├─ Review details ─> Evidence summary
       └─ Already sent money? (checklist)    │        ├─ Warn family
  History                                    │        └─ Result looks wrong
  Help (FAQ, 1930, cybercrime.gov.in)        │
  Settings (language, theme, text size, contrast, consent, account)
  404, scan expired, error screens
```

## Rules for every screen

- Mobile first; works from 360 px wide up to desktop.
- 1930 helpline reachable from every app screen.
- Never show "100% fake" or any accuracy percentage; show a risk level with reasons.
- All text comes from translation files; no text in components.
- Demo mode is always visible while results are simulated (until the backend exists in Step 4).
