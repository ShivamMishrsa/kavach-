# Step 2: Design System (Roadmap Phase 2)

**Status:** Done (see notes: translations are drafts)

## Goal
Option A ke hisab se design tokens, components aur languages, taaki UI baad me aasani se badle.

## Tasks
- [x] Design tokens (colours, spacing, radius, font sizes) ek jagah: `microservices/frontend/src/styles/tokens.css`
- [x] Theme: **light default**, dark, auto; choice browser me yaad rahti hai (`ThemeProvider`)
- [x] Large-text (normal / bada / sabse bada) aur high-contrast mode
- [x] Tailwind v4 setup. **shadcn/ui CLI use nahi kiya**; shadcn jaisa pattern khud banaya (Radix Dialog + class-variance-authority + `cn` helper)
- [x] Lucide icons
- [x] Fonts (self-hosted via Fontsource, koi CDN nahi): Inter + Noto Sans Devanagari / Bengali / Tamil / Telugu / Gujarati; script fonts sirf us language ke use par load hote hain
- [x] Risk colours (kam, madhyam, adhik, bahut adhik, cannot verify) 4 modes me contrast-tested (`npm run check:contrast`, sab pairs 4.5:1 ya upar)
- [x] i18n: **English default**; Round 1 languages: English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati; language registry (`src/i18n/languages.ts`) me native name, review status, scan support
- [x] Language picker (`LanguagePicker`, har language apni script me) aur dropdown (`LanguageSelect`, Settings ke liye); language browser me yaad rahti hai
- [x] Components: Button, Input (label, hint, error, aria), UploadBox (file chooser + camera input), Stepper, RiskCard (badge, level bar, reasons, disclaimer, "result galat laga"), EntityField, Dialog, Toast (Sonner), EmergencyStrip, Segmented, SettingsPanel
- [x] Accessibility: min 44px touch targets, aria labels, radio-group semantics, reduced-motion respect
- [x] Keyboard test (automated, headless browser): Tab sirf interactive elements par jata hai, Enter se theme badalta hai, Escape se dialog band hota hai aur focus wapas trigger par aata hai
- [x] Mobile-first layouts; 390px (phone) aur 1100px (desktop) par dekha

## Verified
- `npm test`: 35 tests pass (file validation, risk levels, har language ke keys/placeholders English se match, 1930 har language me, registry)
- `npm run lint`: saaf; `npm run build`: pass; `npm run check:contrast`: pass
- Headless browser functional test: **28/28 checks pass** (default English + light, theme/text-size/contrast clicks, language select + picker + reload persistence, Tamil font on-demand load, dialog open/Escape/focus, toast, input error, upload validation)
- Screenshots dekhe: light, dark, bada text + high contrast, desktop, Bengali, Tamil, Marathi, Gujarati, Telugu, dialog

## Not done / honest notes
- **Translations (Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati) AI-written drafts hain**, kisi native speaker ne review nahi kiye. App me "Translation under review" tag dikhta hai. Live karne se pehle review zaroori (khaaskar risk messages aur disclaimer).
- Language registry me `scanSupport` abhi **plan** hai (Hindi/English full, baaki limited); asli scan Step 4 me banega.
- Real screen reader (NVDA/TalkBack) se test nahi hua.
- Camera capture asli phone par test nahi hua.
- Radio-group controls me abhi sab buttons Tab se aate hain; arrow-key navigation (roving tabindex) baad me polish me.
- Tablet size par alag se nahi dekha.
- First-run flow screens (Sign up / Log in / Continue as guest, phir language screen) **Step 3** me banenge; yahan sirf building blocks bane.

## References
`design-mockups/Option-A-Calm-Trust-Light.png`, `Option-B-Security-Console-Dark.png`, `Option-C-Big-Friendly-Warm.png`

## Exit criteria
- [x] Component page (`src/pages/DesignSystem.tsx`) light + dark dono me sahi dikhta hai
- [x] English default, 7 languages switch hote hain aur yaad rahte hain
