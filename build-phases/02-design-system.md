# Step 2: Design System (Roadmap Phase 2)

**Status:** Done (with the notes below)

## Goal
Option A ke hisab se design tokens aur components, taaki UI baad me aasani se badle.

## Tasks
- [x] Design tokens (colours, spacing, radius, font sizes) ek jagah: `microservices/frontend/src/styles/tokens.css`
- [x] Theme: **light default**, dark, auto; choice browser me yaad rahti hai (`ThemeProvider`)
- [x] Large-text (normal / bada / sabse bada) aur high-contrast mode
- [x] Tailwind v4 setup. **shadcn/ui CLI use nahi kiya**; shadcn jaisa pattern khud banaya (Radix Dialog + class-variance-authority + `cn` helper)
- [x] Lucide icons
- [x] Fonts: Noto Sans Devanagari + Inter (self-hosted via Fontsource, koi Google CDN nahi)
- [x] Risk colours (kam, madhyam, adhik, bahut adhik, cannot verify) 4 modes me contrast-tested (`npm run check:contrast`, light, dark, light+HC, dark+HC, sab 4.5:1 ya upar)
- [x] i18n: Hindi (default) / English, saara text translation files me (+ test jo dono ke keys match karta hai)
- [x] Components: Button, UploadBox (file chooser + camera input), Stepper, RiskCard (badge, level bar, reasons, disclaimer, "result galat laga"), EntityField (confirm/edit), Dialog, Toast (Sonner), EmergencyStrip, Segmented control, SettingsPanel
- [ ] Generic `Input` component: abhi nahi banaya (EntityField ka apna input hai); Step 3/7 me forms ke saath banega
- [x] Accessibility: min 44px touch targets, aria labels, radio-group semantics, reduced-motion respect
- [ ] Manual keyboard / screen-reader test: abhi nahi kiya
- [x] Mobile-first layouts; 390px (phone) aur 1100px (desktop) par screenshot se dekha

## Verified
- `npm test`: 11 tests pass (file validation, risk levels, translation key parity)
- `npm run lint`: koi warning/error nahi, `npm run build`: pass
- Headless browser screenshots: light, dark, bada text + high contrast, desktop English

## Not verified yet
- Dialog aur Toast kabhi open karke screenshot me nahi dekhe (sirf code compile/test hua)
- Theme toggle buttons par asli click test nahi kiya (saved preference se load hona verify hua)
- Camera capture asli phone par test nahi hua

## References
`design-mockups/Option-A-Calm-Trust-Light.png`, `Option-B-Security-Console-Dark.png`, `Option-C-Big-Friendly-Warm.png`

## Exit criteria
- [x] Component page (`src/pages/DesignSystem.tsx`) light + dark dono me sahi dikhta hai
