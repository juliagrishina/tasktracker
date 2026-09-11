# E11-T29 Offline PWA Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exported web application reopen offline after a prior authenticated launch by precaching only static PWA shell files, with delayed safe updates and no Auth or Supabase response caching.

**Architecture:** Expo emits `dist` through `expo export --platform web`. A local CommonJS build script calls `workbox-build.generateSW()` to create `dist/sw.js` from the output files. `src/app/+html.tsx` registers that worker only in the web HTML entry. T28 IndexedDB holds business data; Auth and sync continue to issue their normal network requests.

**Tech Stack:** Expo SDK 57, Expo Router, TypeScript, Jest, Node.js, Workbox Build.

**Spec:** `docs/superpowers/specs/2026-09-10-e11-t29-offline-pwa-shell-design.md`

## Global Constraints

- Keep `expo.web.output` as `static`; do not implement EAS Hosting, deploy, Redirect URL changes, offline first sign-in, re-auth or sync-engine changes.
- Public staging URL and publishable key may be in the web bundle. Worker and precache manifest must not contain a token, service role, SMTP credential or API response.
- Do not configure `runtimeCaching`, navigation fallback, `skipWaiting: true` or `clientsClaim: true`.
- Precache only HTML, JS, CSS, fonts, icons, images, favicon and web manifest. Exclude source maps and generated worker files; set `inlineWorkboxRuntime: true` so Windows paths with Cyrillic characters never become external worker imports.
- Do not commit `dist`, cache data, `.env`, sessions or credentials.

### Task 1: Generate the shell-only worker

**Files:** create `scripts/generate-pwa-service-worker.cjs`; create `__tests__/pwa-service-worker-build.test.ts`; modify `package.json` and `package-lock.json`.

**Interfaces:** `createPwaServiceWorkerConfig(distDirectory)` returns Workbox configuration. `generatePwaServiceWorker(distDirectory?)` calls `generateSW`, returning its result and rejecting an empty precache. `web:export` calls Expo export then the generator.

- [x] Write `__tests__/pwa-service-worker-build.test.ts` before the script exists. Require the future module and test that `createPwaServiceWorkerConfig('C:/tmp/dist')` has `globDirectory`, `swDest: 'C:/tmp/dist/sw.js'`, `cleanupOutdatedCaches: true`, `skipWaiting: false`, `clientsClaim: false`, `globIgnores` containing `sw.js` and `**/*.map`, and no `runtimeCaching` or `navigateFallback` property.
- [x] Add a second test that writes temporary `index.html`, `manifest.json` and `_expo/static/js/entry.js`, calls `generatePwaServiceWorker(tempDirectory)`, and expects generated `sw.js` to reference all three files.
- [x] Run `npm test -- --runInBand __tests__/pwa-service-worker-build.test.ts`; it must fail because the generator is absent.
- [x] Install `workbox-build` as a dev dependency. Implement the CommonJS script with `generateSW`, static `globPatterns` for `html,js,css,json,png,jpg,jpeg,webp,svg,ico,woff,woff2,ttf,otf`, ignores `sw.js`, `workbox-*.js` and maps, `swDest`, `cleanupOutdatedCaches: true`, `inlineWorkboxRuntime: true`, `skipWaiting: false`, `clientsClaim: false`, and no runtime or navigation options. Export both functions and fail the CLI when Workbox reports zero files.
- [x] Change `web:export` to `expo export --platform web && node scripts/generate-pwa-service-worker.cjs`.
- [x] Re-run the focused test; it must pass. Commit the test, generator, `package.json` and lockfile as `feat(pwa): generate offline shell worker`.

### Task 2: Register the worker from the web HTML entry

**Files:** create `src/pwa/service-worker-registration.ts`; create `__tests__/pwa-service-worker-registration.test.ts`; modify `src/app/+html.tsx`.

**Interfaces:** `serviceWorkerRegistrationScript` is a string. It waits for `load`, registers `/sw.js` with `{ updateViaCache: 'none' }`, ignores registration failure and contains no force-activation call. `+html.tsx` injects that string with `dangerouslySetInnerHTML` before the manifest link.

- [x] Write the failing test that imports `serviceWorkerRegistrationScript` before the module exists. Assert it contains the `serviceWorker` feature test, `window.addEventListener('load'`, `register('/sw.js', { updateViaCache: 'none' })` and `.catch(() => undefined)`, and does not contain `skipWaiting` or `clients.claim`.
- [x] In the same test, read `src/app/+html.tsx` and assert it contains both `serviceWorkerRegistrationScript` and `dangerouslySetInnerHTML`.
- [x] Run `npm test -- --runInBand __tests__/pwa-service-worker-registration.test.ts`; it must fail because the module is absent.
- [x] Add `serviceWorkerRegistrationScript` with the exact registration code. Import it in `+html.tsx` and inject it in `<head>` before `<link rel="manifest">`.
- [x] Re-run the focused test; it must pass. Commit the test, helper and HTML entry as `feat(pwa): register offline shell worker`.

### Task 3: Verify production export and document PWA acceptance

**Files:** modify `__tests__/pwa-installation-assets.test.ts` and `docs/testing/epic-11-auth-and-sync-e2e-checklist.md`.

- [x] Extend the local `expo.web` test type with `output?: string`, then add a test assertion that `expo.web.output` equals `static`. The assertion should be green immediately because it records an existing prerequisite.
- [x] Run all three PWA tests: installation assets, build generator and registration. They must pass together.
- [x] Add an E11-T31 HTTPS staging-only manual check: after a new staging deploy keep the previous PWA open and confirm it does not reload; close it fully, reopen it, and confirm the new shell activates without losing IndexedDB data or outbox.
- [x] Run `npm run web:export`, assert `dist/sw.js` exists, and safely assert it contains `index.html` and `manifest.json`; never print bundle or environment values.
- [x] Run `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, `npm run web:export` and `git diff --check`. Confirm `dist` is ignored.
- [x] Commit the test and checklist changes as `test(pwa): verify static offline shell contract`, then push the current branch.

### Task 4: Final scope review

- [x] Confirm the final diff precaches static assets only; it has no runtime cache or navigation fallback; `skipWaiting` and `clientsClaim` remain false; `/sw.js` registration uses `updateViaCache: 'none'`; native code has no browser service-worker dependency; EAS Hosting and offline first sign-in remain unchanged.
- [x] Run `git status --short --branch` and `git log --oneline -4`. Report final SHA, automated checks and the remaining manual constraint: installed iPhone PWA smoke requires the HTTPS staging URL from E11-T30.
