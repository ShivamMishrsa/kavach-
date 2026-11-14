# Kavach: Website Build Phases (9 Steps)

Website pehle (mobile-first), phir PWA. Ye 9 steps `Project Kavach - Phase-wise Build Roadmap.pdf` ke 20 phases ko website-first order me jodte hain.

## Fixed decisions
- Design: **Option A "Calm Trust"** (light, blue). Default theme **light**; dark theme settings se (Option B colours).
- Frontend: **React + Vite**, mobile-first. App **English me khulta hai**; signup/login ya "Continue without account" (guest mode rahega) ke baad user apni language chunta hai (Round 1: English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati).
- Pehle banega: notice scan, entities (UTR/UPI/phone), link check, dossier. Voice scan baad me ("experimental" label).
- Result me **risk level + reasons**, koi accuracy % ya "100% fake" claim nahi.
- Repo private: `ShivamMishrsa/kavach-`.

## Steps

| # | Step | Roadmap phases | Status |
|---|---|---|---|
| 1 | [Setup](01-setup.md) | 0 | Done |
| 2 | [Design system](02-design-system.md) | 2 | Done (translations are drafts) |
| 3 | [Mobile-first screens (mock data)](03-mobile-first-screens.md) | 1 (light), 3 | Done (results simulated) |
| 4 | [Minimal backend (OCR + rules + Hindi result)](04-minimal-backend.md) | 6, 7, 8 (minimal) | Done (rules unmeasured) |
| 5 | [Dossier PDF + consent + auto-delete](05-dossier-consent-delete.md) | 9, 5 (basic) | Done (PDF in all 7 languages) |
| 6 | [Landing, help, privacy pages](06-landing-help-privacy.md) | 3, 10 | Done (legal text is a draft) |
| 7 | [Auth + settings](07-auth-settings.md) | 4, 10 | Done (email link; Google later) |
| 8 | [Accuracy, tests, deploy](08-accuracy-tests-deploy.md) | 14, 15, 16 | Done in code and measured (not live: needs your accounts) |
| 9 | [PWA + packaging](09-pwa-packaging.md) | 18 | Not started |

## Working rules
- Har step ke end me **kuch chalta hua dikhe** aur git me commit ho.
- Pehle ek patla end-to-end slice (upload -> Hindi result), phir har step usse gehra karta hai.
- Jo roadmap phases yahan nahi hain (B2B portal, admin, dataset pipeline, microservice split, full legal review, post-launch) wo website ke baad ke kaam hain.
- Koi claim (accuracy, latency) tabhi likho jab measure ho chuka ho.
- Jahan "(verify)" likha ho, official source/lawyer se confirm karo.
