# Drum Practice OS — PWA V1

React + TypeScript + Vite + vite-plugin-pwa. Works on iPhone, Android, Mac and Windows via browser. Does not require Xcode.

## V1 features
- Adaptive daily plan based on priority, days since last practice, and manually entered accuracy
- Exercise library (8 presets), timer, Web Audio metronome (3/4 to 7/4), practice logging
- KPI summary, history, JSON export, offline app shell after first successful load
- Local storage per browser/device; **no account, no cross-device sync, no automatic audio analysis, no actual push reminders yet**

## Quick start on a computer (optional)
Install Node.js LTS, then:
```bash
npm install
npm run dev
```
Build check:
```bash
npm run build
```

## Deploy using GitHub + Vercel (can be done on iPhone)
1. Unzip the project. Create a new GitHub repository, e.g. `drum-practice-os`.
2. Upload **all project files and folders**, including `src`, `public`, `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts` (do not upload ZIP alone).
3. Visit https://vercel.com/new and sign in with GitHub. Import the repository.
4. Framework preset **Vite**, Build Command `npm run build`, Output Directory `dist` (usually autodetected). Click Deploy.
5. Open the HTTPS Vercel URL on iPhone in Safari; tap Share > Add to Home Screen > Add.
6. On Android, open the URL in Chrome and choose Install app / Add to Home screen.

Vercel has a free Hobby tier subject to its terms and limits. No secrets/API keys are needed for V1.

## Test
1. Open Today, start Single Stroke, press Start, enable Click, practice 10+ seconds.
2. Enter accuracy and mistakes, save, check History.
3. Record 3 consecutive sessions at target BPM, accuracy >=95%, errors <=2. Target should rise 5 BPM.
4. Reload and verify saved sessions remain.
5. Open app offline after an online visit. The app shell should load, subject to browser cache behavior.

## Known limitations
- The metronome schedules audio ahead via Web Audio but browser/OS may suspend audio when screen locks or app is backgrounded. Keep screen awake and use headphones if needed.
- Accuracy is self-reported; no microphone analysis in V1.
- Adaptive BPM rules are heuristic. Deleting history does not automatically reverse previously adjusted target BPM.
- Settings include a reminder time placeholder, **not an active notification**.
- LocalStorage can be erased by browser data clearing; use Export JSON for backup. Restore/import is planned for V1.1.
- Adding a custom exercise uses a basic browser prompt; richer editing is planned.
- A service worker is generated during production build; dev mode may not be installable as a PWA.
