# E11-T30 Staging PWA on EAS Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a guarded, reproducible EAS Hosting staging PWA deployment that uses only the public staging Supabase configuration and a stable HTTPS `staging` alias.

**Architecture:** A committed public-origin contract drives a dependency-free Node guard. The guard validates `.env.local` without printing values and inspects the exported `dist` before deployment. Package scripts chain the guard, static export and an explicit EAS CLI command; remote project creation, environment-variable writes, deploy and Supabase Redirect URL changes remain manual, separately authorized operations.

**Tech Stack:** Expo SDK 57, Expo Router static export, Workbox output from E11-T29, Node.js CommonJS, Jest, EAS CLI 23.2.0, EAS Hosting Free-plan `preview` environment.

**Spec:** `docs/superpowers/specs/2026-09-11-e11-t30-staging-pwa-eas-hosting-design.md`

## Global Constraints

- Keep `expo.web.output` equal to `static`; do not add EAS Update, native EAS Build, TestFlight, custom domain, EAS Workflow, CI deploy or automatic deploy.
- Use Expo owner `grishina13`, EAS environment `preview`, alias `staging`, never `--prod`; initial preview domain is `plan-my-plan` only after external approval.
- Commit the public staging Supabase HTTPS origin but never the publishable key, `.env`, session, token, SMTP, Resend, Trello, Microsoft OAuth, service role or action-ticket pepper.
- `qa:verify` must fail closed on invalid local configuration; guard output must name only invalid variable names/categories, never values or bundle contents.
- E11-T29 service-worker contract is immutable: no runtime caching, navigation fallback, forced activation or API/Auth/OTP caching.
- Do not run `eas init`, `eas env:set`, `eas deploy`, Supabase Dashboard changes or publish while implementing repository changes. Each is an external action requiring a new explicit user approval.

---

## File structure

- `eas.json` — minimum EAS CLI version, no build/submit/deploy profile.
- `app.json` — `expo.owner: "grishina13"`; no project ID until `eas init` is explicitly approved.
- `qa/staging-web-contract.json` — canonical public staging Supabase URL and exact allowed public app variable names.
- `scripts/verify-qa-staging-config.cjs` — dotenv parser, environment validator and static-output inspector.
- `__tests__/qa-staging-deploy-guard.test.ts` — unit coverage for pure guard functions and CLI failure paths.
- `__tests__/eas-hosting-config.test.ts` — app/EAS/npm-script contract.
- `package.json` and `package-lock.json` — named QA/export/deploy scripts; no new dependency.
- `docs/operations/e11-t30-staging-pwa-eas-hosting.md` — operator-only, staging-only deployment/rollback procedure.
- `docs/testing/epic-11-auth-and-sync-e2e-checklist.md` — explicit E11-T30 staging-alias prerequisite for PWA acceptance.

### Task 1: Add the public staging contract and pure guard

**Files:** create `qa/staging-web-contract.json`, `scripts/verify-qa-staging-config.cjs`, `__tests__/qa-staging-deploy-guard.test.ts`.

**Interfaces:**

```js
parseDotenv(source) // => Record<string, string>
validateStagingEnvironment(values, contract) // throws Error with names only
inspectStaticExport(directory) // throws Error with filenames/categories only
runVerification({ envFile, distDirectory, inspectDist }) // => undefined
```

- [x] Write `__tests__/qa-staging-deploy-guard.test.ts` first. Use a fixture contract with `https://staging.example.supabase.co` and tests for: accepted HTTPS URL plus `sb_publishable_` key; rejected mismatched origin; rejected `http:` origin; rejected missing publishable key; rejected forbidden `SUPABASE_SERVICE_ROLE_KEY` and `SMTP_PASSWORD`; accepted `dist` containing `index.html`, `manifest.json`, `sw.js` and `_expo/static/js/entry.js`; rejected source-map file and a credential-shaped `sb_secret_` value while allowing a bare SDK prefix.
- [x] Run `npm test -- --runInBand __tests__/qa-staging-deploy-guard.test.ts`; expect module-not-found failure for `scripts/verify-qa-staging-config.cjs`.
- [x] Create `qa/staging-web-contract.json` by safely taking only the existing local staging URL (not key) and setting `publicVariableNames` exactly to `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not print the file's value during this step.
- [x] Implement `scripts/verify-qa-staging-config.cjs` with Node built-ins only. `parseDotenv` accepts blank/comment lines, `export NAME=value`, single/double quoted values and preserves `=` after the first separator. `validateStagingEnvironment` requires exactly the two app public names, compares URL origin to the contract, checks HTTPS and `sb_publishable_` prefix, and rejects a case-insensitive set of forbidden server-only names. `inspectStaticExport` recursively lists `dist`, requires root `index.html`, `manifest.json`, `sw.js` and one JS asset, rejects `.map` files and scans text assets for credential-shaped server-secret patterns without printing their contents. `runVerification` reads JSON/env files, selects config-only or config-plus-dist mode from explicit paths, and prints only `QA staging configuration verified.` on success.
- [x] Re-run the focused guard test; it must pass. Then run the guard once against the real ignored `.env.local` in config-only mode and verify it prints no value.
- [x] Commit the guard, contract and test as `feat(qa): guard staging public web configuration`.

### Task 2: Add explicit EAS and QA command contracts

**Files:** create `eas.json`, `__tests__/eas-hosting-config.test.ts`; modify `app.json`, `package.json`.

**Interfaces:**

```json
// eas.json
{ "cli": { "version": ">= 23.2.0" } }
```

```json
// package.json scripts
{
  "qa:config": "node scripts/verify-qa-staging-config.cjs --env-file .env.local",
  "qa:verify": "npm run qa:config && npm run typecheck && npm run lint && npm test",
  "qa:staging:export": "npm run qa:verify && npm run web:export && node scripts/verify-qa-staging-config.cjs --env-file .env.local --dist dist",
  "qa:staging:deploy": "npm run qa:staging:export && npx --yes eas-cli@23.2.0 deploy --environment preview --alias staging --export-dir dist"
}
```

- [x] Write `__tests__/eas-hosting-config.test.ts` first. Assert `expo.owner` is `grishina13`, `expo.web.output` is `static`, `app.json` has no `extra.eas.projectId`, `eas.json.cli.version` is `>= 23.2.0`, and the four scripts have the exact command contracts above. Assert `qa:staging:deploy` has no `--prod`, no custom-domain flag and no auto-deploy lifecycle hook.
- [x] Run `npm test -- --runInBand __tests__/eas-hosting-config.test.ts`; expect missing `eas.json` and script-contract failures.
- [x] Add the minimum `eas.json`; set `expo.owner` in `app.json`; add the four scripts exactly as above. Do not add `projectId`, build profiles, dependencies, `postinstall`, `prepare`, CI files or workflow files.
- [x] Re-run the configuration test and `npm run qa:config`; both must pass. Run `npm run qa:staging:export`; it must finish with static `dist/sw.js` and no upload.
- [x] Commit config, scripts and test as `feat(pwa): configure guarded staging hosting`.

### Task 3: Document external deployment and manual acceptance

**Files:** create `docs/operations/e11-t30-staging-pwa-eas-hosting.md`; modify `docs/testing/epic-11-auth-and-sync-e2e-checklist.md`.

**Interfaces:** The operations guide is the sole operator interface for external state. It separates repository preparation from externally authorized commands and names the expected stable alias format without claiming it exists before the first deploy.

- [x] Write an operations guide with these numbered stages: preflight (`npx eas-cli@23.2.0 whoami` must show `grishina13`; `npm run qa:staging:export`); separate approval checkpoint; first deploy command with `--dev-domain plan-my-plan --environment preview --alias staging --export-dir dist`; handling of domain-unavailable result by stopping and asking the user; dashboard creation of exactly two public preview variables; staging-only Supabase Redirect URL addition of the actual alias; recurring deploy using `npm run qa:staging:deploy`; rollback by reassigning alias to a known good immutable deployment; no production/custom-domain/secret action.
- [x] Amend the E11-T31 checklist preparation section: it requires the HTTPS alias produced by T30, declares Expo Go/LAN/tunnel invalid for installed-PWA evidence, and requires recording the immutable deployment ID/commit without tokens.
- [x] Run `npm test -- --runInBand __tests__/qa-staging-deploy-guard.test.ts __tests__/eas-hosting-config.test.ts`, `npm run qa:staging:export`, `npm run typecheck`, `npm run lint`, full `npm test`, and `git diff --check`. Confirm `dist` and `.env.local` remain ignored.
- [x] Commit documentation and checklist changes as `docs(pwa): document guarded staging deployment`, then push the branch.

### Task 4: External operations gate and final scope review

- [x] Run `git status --short --branch`, `git log --oneline -4` and inspect the full T30 diff. Confirm no EAS project was linked, no EAS variable changed, no deployment was published and no Supabase redirect changed during repository implementation.
- [ ] Report the final SHA, checks and untouched external actions. Ask separately for permission before each external action: EAS link/first deployment; EAS preview variables; staging Supabase Redirect URL; staging browser/iPhone PWA smoke.
