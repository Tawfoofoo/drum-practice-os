# Drum Practice OS — PWA V1.1

Upgrade of V1 with editable exercise library. React + TypeScript + Vite. Retains the same `drum.exercises.v1`, `drum.records.v1`, and `drum.settings.v1` localStorage keys to preserve existing sessions and adaptive targets.

## Features
- Add/edit exercise name, category, description, target BPM, minutes, priority.
- Archive/restore exercises; history is retained. Permanent delete is allowed only if no sessions reference that exercise.
- Category filter and optional archived view.
- Adaptive planner ignores archived exercises, and includes newly created active exercises.
- JSON export/import in Settings; import replaces all existing local data only after confirmation.

## Update existing GitHub/Vercel app
1. First open the existing app on iPhone, Settings > Export Backup JSON. Save the backup in Files.
2. In your existing `drum-practice-os` GitHub repository on `main`, replace `src/App.tsx`, `src/engine.ts`, `src/style.css`, and `README.md` with files from this release. Keep all other files unchanged.
3. Vercel auto-deploys after commit. Check deployment status and refresh the installed PWA. On iOS, closing and reopening may be needed for the service worker to update.
4. Confirm old history and exercises are still present before changing data. If needed, use Settings > Import Backup JSON.

## Important
The browser's localStorage is specific to the origin and browser installation context. A standalone Home Screen PWA and Safari may not share the same storage. Do not uninstall the old PWA or clear website data until backup and migration are confirmed. No backend sync in V1.1. Accuracy is self-reported. Archive does not delete history.

## Local build
`npm install` then `npm run build`.
