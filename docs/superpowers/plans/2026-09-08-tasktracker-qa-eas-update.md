# TaskTracker QA EAS Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one reusable, staging-only EAS Update QA delivery path that opens Epic revisions in Expo Go on an iPhone without LAN, VPN routing, or ngrok.

**Architecture:** The repository will contain the permanent EAS project link, the `qa` update channel, a QA-only build profile, and a small local guard that refuses a non-staging Supabase configuration. Expo's `preview` environment will hold the two public staging variables because it is available on the free plan; `qa` remains the only update channel. Each worktree keeps its own ignored `.env.local` for local Metro, while EAS Update obtains the same public values from the remote `preview` environment.

**Tech Stack:** Expo SDK 57, Expo Go, `expo-updates`, EAS CLI, Node.js, Jest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-08-tasktracker-qa-eas-update-design.md`

## Global Constraints

- Target only the separate TaskTracker QA EAS project; never create a production EAS profile, channel, update, build, or deployment.
- Target only Supabase staging project `zwckrqbdepgvenanyans`; reject every other URL before an EAS environment change or update publication.
- Store only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS `preview` environment; no service-role, SMTP, CAPTCHA, OTP, ngrok, or Edge Function secret is permitted.
- Keep `.env.local` ignored and do not print its contents, the publishable key, or any Expo access token.
- Do not publish an EAS update in this setup task. A QA publication remains a separate, explicit user action.
- Keep the Expo Go path limited to Expo Go-compatible JavaScript, style, and asset updates. A native dependency or permission change requires a separately approved EAS development build.

---

### Task 1: Add a local staging guard and its executable contract

**Files:**
- Create: `tools/eas/verify-qa-staging.mjs`
- Create: `__tests__/configuration/eas-qa-contract.test.ts`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: an ignored repository-root `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Produces: `npm run qa:verify`, exit code `0` only when the local file is ignored, the URL is exactly `https://zwckrqbdepgvenanyans.supabase.co`, and the publishable key is non-empty.
- Produces: `npm run qa:publish -- --message "Epic 11: authentication manual acceptance"`, which runs the guard before delegating to EAS. The command must not be run until the user explicitly requests publication.

- [ ] **Step 1: Write the failing repository contract test**

```ts
test('defines a staging-only QA verification and publication entry point', () => {
  const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  const guard = readRepositoryFile('tools', 'eas', 'verify-qa-staging.mjs');

  expect(packageJson.scripts?.['qa:verify']).toBe('node tools/eas/verify-qa-staging.mjs');
  expect(packageJson.scripts?.['qa:publish']).toContain('qa:verify');
  expect(guard).toContain('https://zwckrqbdepgvenanyans.supabase.co');
  expect(guard).toContain('git check-ignore --quiet .env.local');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts`

Expected: FAIL because neither QA script nor the guard exists.

- [ ] **Step 3: Implement the guard and scripts**

Create `tools/eas/verify-qa-staging.mjs` with this flow:

```js
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedUrl = 'https://zwckrqbdepgvenanyans.supabase.co';
const envPath = resolve(process.cwd(), '.env.local');
const variables = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split(/=(.*)/su))
    .filter(([name, value]) => name !== undefined && value !== undefined)
);

if (variables.EXPO_PUBLIC_SUPABASE_URL !== expectedUrl) {
  throw new Error('QA publication is allowed only for the configured staging Supabase project.');
}
if (!variables.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error('The staging Supabase publishable key is required in .env.local.');
}
execFileSync('git', ['check-ignore', '--quiet', '.env.local'], { stdio: 'ignore' });
console.log('QA staging environment verified.');
```

Add these exact scripts to `package.json`:

```json
"qa:verify": "node tools/eas/verify-qa-staging.mjs",
"qa:publish": "npm run qa:verify && npx eas-cli@latest update --channel qa --environment preview"
```

Extend `.env.example` with comments that name only the two allowed public staging variables and state that `.env.local` is required for local QA. Do not put values in the example file.

- [ ] **Step 4: Run the targeted verification**

Run: `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts && npm run qa:verify && npm run typecheck`

Expected: test passes, guard prints only its success message, and TypeScript passes.

- [ ] **Step 5: Commit the guard**

```bash
git add package.json .env.example tools/eas/verify-qa-staging.mjs __tests__/configuration/eas-qa-contract.test.ts
git commit -m "feat(qa): guard EAS updates to staging"
```

### Task 2: Link the single QA EAS project and configure Expo Updates

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `eas.json`
- Modify: `__tests__/configuration/eas-qa-contract.test.ts`

**Interfaces:**
- Consumes: a signed-in Expo account and the staging-safe guard from Task 1.
- Produces: one `extra.eas.projectId` and `updates.url` in `app.json`, one `runtimeVersion` policy, a dependency on `expo-updates`, and the sole `qa` EAS build profile.
- Produces: update compatibility with Expo Go for the SDK 57 JavaScript bundle; it does not create an iOS binary or App Store/TestFlight artifact.

- [ ] **Step 1: Extend the failing contract test**

```ts
test('contains only the permanent QA EAS Update configuration', () => {
  const appConfig = require('../../app.json') as { expo: Record<string, unknown> };
  const easConfig = JSON.parse(readRepositoryFile('eas.json')) as {
    build?: Record<string, { channel?: string; environment?: string }>;
  };
  const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
    dependencies?: Record<string, string>;
  };

  expect(packageJson.dependencies?.['expo-updates']).toMatch(/^~57\./u);
  expect(appConfig.expo.updates).toEqual(expect.objectContaining({ url: expect.stringMatching(/^https:\/\/u\.expo\.dev\//u) }));
  expect(appConfig.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
  expect(easConfig.build).toEqual({ qa: expect.objectContaining({ channel: 'qa', environment: 'preview' }) });
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts`

Expected: FAIL because `expo-updates`, the EAS project link, and `eas.json` are absent.

- [ ] **Step 3: Authenticate and create/link the QA EAS project once**

Run: `npx eas-cli@latest whoami`.

If it reports no account, run `npx eas-cli@latest login` and let the user complete Expo authentication in the browser. Then run `npx eas-cli@latest init` from this worktree, create the project named `tasktracker-qa`, and record the generated non-secret project ID in the app configuration. Do not accept, create, or link a project whose name indicates production.

- [ ] **Step 4: Install and configure the Expo Update client**

Run: `npx expo install expo-updates`, then `npx eas-cli@latest update:configure`.

Retain the `runtimeVersion` policy written by the CLI as `{ "policy": "appVersion" }`. Retain the `updates.url` and `extra.eas.projectId` values written by the CLI without manually changing them; both must identify the newly created `tasktracker-qa` EAS project.

Create `eas.json` with only this profile:

```json
{
  "build": {
    "qa": {
      "distribution": "internal",
      "channel": "qa",
      "environment": "preview"
    }
  }
}
```

Do not run `eas build`; the profile is retained only as the safe future route if Expo Go compatibility is lost.

- [ ] **Step 5: Run Expo configuration and targeted checks**

Run: `npx expo config --type public`, `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts`, and `npm run typecheck`.

Expected: public config contains the generated QA project ID and `https://u.expo.dev/` URL; target test and TypeScript pass; no production channel or profile exists.

- [ ] **Step 6: Commit the EAS linkage**

```bash
git add app.json eas.json package.json package-lock.json __tests__/configuration/eas-qa-contract.test.ts
git commit -m "feat(qa): configure Expo EAS Update channel"
```

### Task 3: Set the remote preview environment and record the reusable operator flow

**Files:**
- Create: `docs/operations/eas-qa-update.md`
- Modify: `__tests__/configuration/eas-qa-contract.test.ts`

**Interfaces:**
- Consumes: linked `tasktracker-qa` EAS project, the user-owned staging public parameters, and the Task 1 guard.
- Produces: project-scoped EAS `preview` environment variables with only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus a documented, repeatable per-worktree process.
- Produces: `qa` update publication command with a human-written `--message`; it is documented but not run during setup.

- [ ] **Step 1: Extend the failing documentation contract test**

```ts
test('documents the preview environment, staging guard, and explicit QA publication', () => {
  const guide = readRepositoryFile('docs', 'operations', 'eas-qa-update.md');

  expect(guide).toContain('preview');
  expect(guide).toContain('EXPO_PUBLIC_SUPABASE_URL');
  expect(guide).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  expect(guide).toContain('npm run qa:verify');
  expect(guide).toContain('--channel qa --environment preview');
  expect(guide).toContain('не публикуйте без явного запроса');
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts`

Expected: FAIL because the operations guide is absent.

- [ ] **Step 3: Create the remote EAS variables without exposing values**

Use the EAS dashboard for the linked `tasktracker-qa` project and create two **project-scoped, plaintext** variables in the `preview` environment:

```text
EXPO_PUBLIC_SUPABASE_URL=https://zwckrqbdepgvenanyans.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=the staging publishable key already stored in the ignored local file
```

Before saving, confirm there are exactly two variables, both names have the `EXPO_PUBLIC_` prefix, and neither is assigned to `production`. Verify their names and environment only; do not print their values.

- [ ] **Step 4: Write the operator guide**

Document these exact sections in `docs/operations/eas-qa-update.md`:

1. One-time guarantees: use only the QA EAS project, `qa` channel, `preview` variables, and staging project ref `zwckrqbdepgvenanyans`.
2. New-worktree preparation: copy `.env.example` to ignored `.env.local`, set the two public staging variables, run `npm run qa:verify`.
3. Explicit delivery: after user approval run `npm run qa:publish -- --message "Epic 11: authentication manual acceptance"`; the EAS command receives `--channel qa --environment preview` through the script.
4. iPhone acceptance: open the QR/link returned by EAS Update in Expo Go, confirm the app connects to staging, then run only the manual checks for the current Epic.
5. Prohibitions: never use `planmeplan.ru`, production Supabase values, production EAS environment, `eas build`, TestFlight, or any secret in this flow.
6. Recovery: stop on a guard failure, fix only `.env.local` or the two remote `preview` values, and publish again only with explicit approval.

- [ ] **Step 5: Verify configuration and documentation**

Run: `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts && npm run qa:verify && npm run typecheck`.

Then inspect the linked EAS project's environment-variable list and report only: project name/ID, environment `preview`, and the two variable names. Do not run `npm run qa:publish`.

- [ ] **Step 6: Commit and push the reusable QA setup**

```bash
git add docs/operations/eas-qa-update.md __tests__/configuration/eas-qa-contract.test.ts
git commit -m "docs(qa): document staging EAS update workflow"
git push
```

### Task 4: Deliver the first QA revision only after a separate explicit request

**Files:**
- Modify: none unless the current Epic worktree itself has an approved implementation change.
- Test: `__tests__/configuration/eas-qa-contract.test.ts`

**Interfaces:**
- Consumes: a clean, checked E11 worktree, Task 1 guard, linked QA EAS project, and the remote `preview` variables from Task 3.
- Produces: an immutable EAS Update group in channel `qa` and an Expo Go QR/link for iPhone manual acceptance.

- [ ] **Step 1: Confirm explicit authorization and the QA target**

Get an explicit request to publish the current worktree. State that the target is the QA EAS project, `qa` channel, `preview` environment, and staging Supabase ref `zwckrqbdepgvenanyans`.

- [ ] **Step 2: Run the pre-publication checks**

Run: `git status --short`, `npm run qa:verify`, `npm test -- --runTestsByPath __tests__/configuration/eas-qa-contract.test.ts`, and `npm run typecheck`.

Expected: no unintended working-tree files; guard and checks pass.

- [ ] **Step 3: Publish the approved QA revision**

Run:

```bash
npm run qa:publish -- --message "Epic 11: authentication manual acceptance"
```

Record the EAS update group ID and Expo Go QR/link returned by the CLI. Do not include either Supabase parameter value in the report.

- [ ] **Step 4: Perform iPhone handoff and close the QA check**

Ask the user to open the QR/link in Expo Go, confirm that the initial registration/authentication screen appears, and complete the current E11 manual checklist against staging test addresses only. Report the update group ID, check results, and any QA-only issue separately; do not merge or deploy to production.

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 implement the persistent project/configuration, staging-only variables, per-worktree guard, and documented operation flow. Task 4 covers the expressly user-authorized publication and iPhone handoff without treating it as setup.
- **Placeholder scan:** No executable configuration value is left undecided. The sole generated value is the EAS project ID, intentionally supplied by `eas init` and immediately committed as a non-secret identifier.
- **Type consistency:** The same `qa` channel, `preview` EAS environment, staging project ref, two public variable names, and `qa:verify`/`qa:publish` scripts are used in all tasks.
