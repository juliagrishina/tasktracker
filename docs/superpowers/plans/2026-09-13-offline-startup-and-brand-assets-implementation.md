# Epic 11 Offline Startup and Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Открывать установленную PWA из сохранённой account-scoped реплики без сети, показывать конечный статус запуска и применить единый комплект брендовых иконок без регрессий синхронизации.

**Architecture:** `AuthGate` выбирает ранее подтверждённую локальную account scope без ожидания сети; `AppServicesProvider` открывает IndexedDB и читает локальные read-model до запуска sync. Boot UI показывает только завершённые локальные этапы, а sync/profile refresh выполняются в фоне. Брендовые PNG являются статическими precached assets, а мелкие правки планирования остаются локальными UI-компонентами.

**Tech Stack:** Expo SDK 57, Expo Router static web export, React Native Web, IndexedDB, Supabase JS, Workbox, Jest, TypeScript, EAS Hosting.

**Spec:** `docs/superpowers/specs/2026-09-13-offline-startup-and-brand-assets-design.md`

## Global Constraints

- Обычный продуктовый режим — «только авторизация»: не возвращать guest entry и не создавать новую автономную область.
- После первого онлайн-входа локальная account scope разрешает только продолжение на том же устройстве; она не заменяет вход на новом устройстве.
- Локальные mutation сначала durable записываются в IndexedDB/outbox; network failure и timeout не скрывают account scope и не стирают данные.
- Sync и remote profile refresh запускаются после показа локального UI; отсутствие сети никогда не блокирует первый рабочий экран.
- Нельзя менять Supabase schema/RLS, Redirect URLs, EAS variables, production deployment или удалять локальные данные в этом наборе работ.
- Исторический `.docx` не читать и не менять.
- Каждая staging-публикация требует нового явного подтверждения пользователя.

---

## File structure

- `src/application/offline-account-recovery.ts` — чистое правило выбора активной account scope при недоступной удалённой сессии.
- `src/ui/primitives/app-boot-screen.tsx` — status-first boot UI с logo, message и доступным progressbar.
- `src/application/auth-gate.tsx` — bounded remote session lookup и переход к local account recovery.
- `src/application/app-services-provider.tsx` — local-first bootstrap, status этапов, background-only initial sync.
- `src/application/account-profile-provider.ts`, `src/application/account-profile.ts`, `src/app/(tabs)/settings.tsx` — cache-first account profile presentation.
- `assets/`, `public/`, `app.json`, `src/app/+html.tsx`, `src/ui/auth/auth-screen.tsx` — брендовые assets.
- `src/ui/plan/progress-ring.tsx`, `src/ui/backlog/item-form-sheet.tsx`, `src/ui/backlog/task-planning-fields.tsx` — исправления плана и редактора.

### Task 1: Recover a confirmed account scope offline

**Files:**
- Create: `src/application/offline-account-recovery.ts`
- Modify: `src/application/auth-gate.tsx`
- Test: `__tests__/application/offline-account-recovery.test.ts`
- Test: `__tests__/application/auth-gate.test.tsx`

**Interfaces:**
- Consumes: `DataScopeRegistry.getActiveScope(): Promise<LocalDataScope>`.
- Produces: `recoverOfflineAccountScope(scopeRegistry): Promise<Extract<LocalDataScope, { kind: 'account' }> | null>`.

- [ ] **Step 1: Write the failing recovery tests**

```ts
it('recovers only a persisted account scope', async () => {
  const recovered = await recoverOfflineAccountScope({
    getActiveScope: async () => ({ kind: 'account', accountId: 'user-17' }),
  } as DataScopeRegistry);
  expect(recovered).toEqual({ kind: 'account', accountId: 'user-17' });
});

it('does not recover an autonomous scope', async () => {
  await expect(recoverOfflineAccountScope({
    getActiveScope: async () => ({ kind: 'autonomous' }),
  } as DataScopeRegistry)).resolves.toBeNull();
});
```

- [ ] **Step 2: Run it and prove red**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/application/offline-account-recovery.test.ts`

Expected: FAIL because the recovery module does not exist.

- [ ] **Step 3: Implement the strict selector**

```ts
export async function recoverOfflineAccountScope(
  scopeRegistry: Pick<DataScopeRegistry, 'getActiveScope'>,
): Promise<Extract<LocalDataScope, { kind: 'account' }> | null> {
  const scope = await scopeRegistry.getActiveScope();
  return scope.kind === 'account' ? scope : null;
}
```

Do not inspect hidden/known accounts and do not create a new scope.

- [ ] **Step 4: Make `AuthGate` bounded and local-first**

Race `gateway.restoreSession()` with a 1,500 ms timeout yielding `null`. If it returns authenticated, preserve the current remote path. If it times out, rejects, or returns signedOut, call `recoverOfflineAccountScope(scopeRegistry)`; when it returns an account scope, call `openAccount(scope.accountId)` and schedule one detached remote refresh. Neither timeout nor refresh failure may call `hideAccountScope`. Extend the AuthGate test with a never-resolving gateway and expect `activeScope` to be `{ kind: 'account', accountId: 'user-17' }` and `gateState` to become app.

- [ ] **Step 5: Run focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/application/offline-account-recovery.test.ts __tests__/application/auth-gate.test.tsx`

Expected: PASS. A known account opens offline; autonomous/signed-out devices show auth.

- [ ] **Step 6: Commit**

```bash
git add src/application/offline-account-recovery.ts src/application/auth-gate.tsx __tests__/application/offline-account-recovery.test.ts __tests__/application/auth-gate.test.tsx
git commit -m "fix: recover account workspace offline"
```

### Task 2: Present cached account identity without a remote dependency

**Files:**
- Modify: `src/application/account-profile.ts`
- Modify: `src/application/account-profile-provider.ts`
- Modify: `src/app/(tabs)/settings.tsx`
- Test: `__tests__/application/account-profile.test.ts`
- Test: `__tests__/ui/settings-screen.test.tsx`

**Interfaces:**
- Consumes: profile cache keyed by the active account's `userId`.
- Produces: `AccountProfileService.loadCached()` and `AccountProfileService.refresh()`.

- [ ] **Step 1: Write failing cache-first tests**

```ts
const service = createAccountProfileService({ cache, gateway: rejectingGateway });
await expect(service.loadCached()).resolves.toEqual({
  kind: 'authenticated',
  displayName: 'Юлия',
  email: 'julia@example.com',
  emailConfirmed: true,
  pendingEmail: null,
});
await expect(service.refresh()).resolves.toEqual(expect.objectContaining({
  kind: 'authenticated',
  email: 'julia@example.com',
}));
```

Render settings with a known account scope and rejecting gateway. Assert `Юлия` and `julia@example.com` are rendered and `Без аккаунта` is absent.

- [ ] **Step 2: Run tests and prove red**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/application/account-profile.test.ts __tests__/ui/settings-screen.test.tsx`

Expected: FAIL because cache-first methods and settings scope wiring do not exist.

- [ ] **Step 3: Implement cache-first service**

Add these interface methods:

```ts
loadCached(): Promise<AccountProfileState>;
refresh(): Promise<AccountProfileState>;
```

`loadCached` only reads `cache.load()`. `refresh` reads the gateway, writes a non-null response to cache, then returns it; on error it returns `loadCached()`. Let existing `load()` return cache first and call `refresh()` only when cache is empty. Do not change write operations: name/email/password changes still require online gateways.

- [ ] **Step 4: Wire settings to the active scope**

Replace the provider factory that first calls remote `getProfile()` with:

```ts
export function createAccountProfileServiceForUser(userId: string): AccountProfileService {
  return createAccountProfileService({
    cache: createAccountProfileCache({ storage: authSessionStorage, userId }),
    gateway: accountProfileGateway,
  });
}
```

In settings read `useAuthGateWorkspace()`. For an account scope, create service immediately, set the cached state, then invoke `void service.refresh().then(setAccount)` only when it returns `authenticated`. A rejected refresh must not set `withoutAccount`.

- [ ] **Step 5: Run focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/application/account-profile.test.ts __tests__/ui/settings-screen.test.tsx`

Expected: PASS. Offline settings preserve account name/email and online refresh can replace stale cache.

- [ ] **Step 6: Commit**

```bash
git add src/application/account-profile.ts src/application/account-profile-provider.ts src/app/(tabs)/settings.tsx __tests__/application/account-profile.test.ts __tests__/ui/settings-screen.test.tsx
git commit -m "fix: preserve account identity offline"
```

### Task 3: Open IndexedDB before sync and show boot progress

**Files:**
- Create: `src/ui/primitives/app-boot-screen.tsx`
- Modify: `src/application/app-services-provider.tsx`
- Modify: `src/application/auth-gate.tsx`
- Modify: `src/app/_layout.tsx`
- Test: `__tests__/ui/app-boot-screen.test.tsx`
- Test: `__tests__/application/app-services.test.tsx`

**Interfaces:**
- Consumes: scope chosen in Tasks 1–2.
- Produces: `bootStatus: { progress: 15 | 45 | 75 | 100; message: BootMessage }` through `AppServicesContext`.

- [ ] **Step 1: Write a failing boot UI test**

```tsx
const view = render(<AppBootScreen message="Открываем локальную копию" progress={45} />);
expect(view.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 100, now: 45 });
expect(view.getByText('45%')).toBeTruthy();
expect(view.getByLabelText('Логотип Plan My Plan')).toBeTruthy();
```

- [ ] **Step 2: Run it and prove red**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/ui/app-boot-screen.test.tsx`

Expected: FAIL because `AppBootScreen` does not exist.

- [ ] **Step 3: Implement determinate `AppBootScreen`**

Create a component that accepts only:

```ts
type BootMessage =
  | 'Восстанавливаем доступ'
  | 'Открываем локальную копию'
  | 'Загружаем ваши планы'
  | 'Готово';
interface AppBootScreenProps {
  progress: 15 | 45 | 75 | 100;
  message: BootMessage;
}
```

Render logo, message, `${progress}%`, and progressbar `accessibilityValue`. The fill uses `{ width: `${progress}%` }`; do not use an indeterminate spinner or timer-driven percent.

- [ ] **Step 4: Write the provider ordering test**

Use a deferred `syncNow` Promise and a recording source. Assert this exact order:

```ts
expect(events).toEqual([
  'source.initialize',
  'settings.get',
  'backlog.read',
  'provider.ready',
  'sync.syncNow',
]);
```

Add a rejected sync case that keeps `isReady === true` and exposes failure only through sync status.

- [ ] **Step 5: Implement local-first bootstrap**

Set boot 45 before `appSource.initialize()`, 75 before local read-model reads, and 100 in the same mounted state update that sets `isReady=true`. Move `syncEngine.syncNow()` to a detached call after local state has been set; its success refreshes status/conflicts and its failure only refreshes status. Keep `initializationError` solely for local storage failures.

- [ ] **Step 6: Wire both boot locations**

Replace `AuthGate` raw `ActivityIndicator` with `<AppBootScreen progress={15} message="Восстанавливаем доступ" />`. Inside `AppServicesProvider` in `_layout.tsx`, render the same component while `isReady` is false, then mount the normal Stack. Remove tab-level first-start loading text from the user path.

- [ ] **Step 7: Run focused tests**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/ui/app-boot-screen.test.tsx __tests__/application/app-services.test.tsx __tests__/application/auth-gate.test.tsx`

Expected: PASS. The local UI becomes ready before sync resolves and the visible boot status is determinate.

- [ ] **Step 8: Commit**

```bash
git add src/ui/primitives/app-boot-screen.tsx src/application/app-services-provider.tsx src/application/auth-gate.tsx src/app/_layout.tsx __tests__/ui/app-boot-screen.test.tsx __tests__/application/app-services.test.tsx __tests__/application/auth-gate.test.tsx
git commit -m "fix: open local workspace before sync"
```

### Task 4: Fix the plan ring and task editor

**Files:**
- Modify: `src/ui/plan/progress-ring.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Test: `__tests__/ui/plan-dashboard.test.tsx`
- Test: `__tests__/ui/backlog-form.test.tsx`
- Test: `__tests__/ui/task-planning-fields.test.tsx`

**Interfaces:**
- Consumes: existing `PlanLoadTone`, `getPlanLoadAppearance`, and `TaskPlanningDraft`.
- Produces: iOS-safe ring input, 2×2 editor actions, first block date derived from `scheduledOn`.

- [ ] **Step 1: Add failing assertions**

For 92% high load, assert:

```tsx
expect(activeCircle.props.strokeDasharray).toEqual([expect.any(Number), expect.any(Number)]);
expect(activeCircle.props.strokeDashoffset).toBeGreaterThan(0);
expect(activeCircle.props.stroke).toBe(designTokens.color.feedback.danger.foreground);
```

For edit Cancel/Complete/Delete/Save, assert footer `flexWrap: 'wrap'` and every action `minHeight: 44`. For date mode with one block, assert no `Дата блока 1`; after changing `Дата задачи`, assert `blocks[0].date` changes; after adding a block, assert `Дата блока 2` exists.

- [ ] **Step 2: Run UI tests and prove red**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/ui/plan-dashboard.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/task-planning-fields.test.tsx`

Expected: FAIL on ring dash input, editor layout, and derived date behaviour.

- [ ] **Step 3: Implement the minimal UI corrections**

Pass `strokeDasharray={[ringCircumference, ringCircumference]}` and numeric `strokeDashoffset={dashOffset}`; keep only `transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}` and remove duplicate `rotation`.

Set `usesActionGrid = mode === 'edit' && visibleActionCount >= 3`; then footer uses `flexWrap: 'wrap'` and actions use `flexBasis: '48%'`, `width: '48%'`, `flexGrow: 0`. Keep old full-width/flex layout for fewer actions.

For first date-mode block, omit the date picker and show `На дату задачи: ${formatPlanningDate(value.scheduledOn)}`. The date picker updates `scheduledOn` plus `blocks.map((block, index) => index === 0 ? { ...block, date: scheduledOn } : block)`. Additional blocks keep their editable date picker.

- [ ] **Step 4: Run regression tests**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/ui/plan-dashboard.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/task-planning-fields.test.tsx`

Expected: PASS. A red 92% arc is visible, editor labels fit in two rows, and only extra blocks expose independent dates.

- [ ] **Step 5: Commit**

```bash
git add src/ui/plan/progress-ring.tsx src/ui/backlog/item-form-sheet.tsx src/ui/backlog/task-planning-fields.tsx __tests__/ui/plan-dashboard.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/task-planning-fields.test.tsx
git commit -m "fix: polish plan load and editor actions"
```

### Task 5: Produce and integrate Plan My Plan assets

**Files:**
- Create: `assets/plan-my-plan-app-icon.png`, `assets/plan-my-plan-auth-logo.png`
- Modify: `public/favicon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/manifest.json`
- Modify: `app.json`, `src/app/+html.tsx`, `src/ui/auth/auth-screen.tsx`
- Test: `__tests__/pwa-installation-assets.test.ts`
- Test: `__tests__/ui/auth-screen.test.tsx`

**Interfaces:**
- Consumes: `C:/Users/Юлия/Desktop/PlanMyPlan/1.png` as app/auth source and `C:/Users/Юлия/Desktop/PlanMyPlan/2.png` as favicon source.
- Produces: square opaque app master, auth logo, 512/192/180 web derivatives, and favicon registered by Expo/manifest/HTML.

- [ ] **Step 1: Add failing asset contract tests**

```ts
expect(app.expo.icon).toBe('./assets/plan-my-plan-app-icon.png');
expect(manifest.icons).toEqual(expect.arrayContaining([
  expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
  expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
]));
```

In auth UI, assert `getByLabelText('Логотип Plan My Plan')` is present and an isolated text `P` brand mark is absent.

- [ ] **Step 2: Run it and prove red**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/pwa-installation-assets.test.ts __tests__/ui/auth-screen.test.tsx`

Expected: FAIL on old paths and the text brand mark.

- [ ] **Step 3: Create identity-preserving derivatives**

Use the image editing tool on `1.png`: preserve lettering, checkmark and colours; remove only outer white corners so the square icon is full-bleed. Inspect it, save a 1024px master and deterministically resize final 512px, 192px and 180px PNG derivatives. Use the image editing tool on `2.png`: preserve its checkmark mark and create a square favicon master plus final favicon PNG. Put final project assets only in `assets/` and `public/`; do not generate a substitute logo.

- [ ] **Step 4: Wire assets**

Set `expo.icon` and `expo.ios.icon` to `./assets/plan-my-plan-app-icon.png`. Keep `+html` links at `/favicon.png` and `/apple-touch-icon.png`; update manifest icon entries. Replace the auth `brandMark` text with `Image` at 88×88, `resizeMode="contain"`, and `accessibilityLabel="Логотип Plan My Plan"`.

- [ ] **Step 5: Verify asset export**

Run:

```bash
node node_modules/jest/bin/jest.js --runInBand __tests__/pwa-installation-assets.test.ts __tests__/ui/auth-screen.test.tsx
npm run web:export
node scripts/verify-qa-staging-config.cjs --env-file .env.local --dist dist
```

Expected: PASS. Export includes the new favicon/app icons and no secret-shaped data or source maps.

- [ ] **Step 6: Commit**

```bash
git add assets/plan-my-plan-app-icon.png assets/plan-my-plan-auth-logo.png public/favicon.png public/icon-192.png public/icon-512.png public/apple-touch-icon.png public/manifest.json app.json src/app/+html.tsx src/ui/auth/auth-screen.tsx __tests__/pwa-installation-assets.test.ts __tests__/ui/auth-screen.test.tsx
git commit -m "feat: apply Plan My Plan brand assets"
```

### Task 6: Update acceptance documentation and run the final checks

**Files:**
- Modify: `docs/tz/account-authentication-and-cloud-sync.md`
- Modify: `docs/tz/epic-09-quality-accessibility-and-release.md`
- Modify: `docs/testing/e11-t31-iphone-pwa-instructions.md`
- Test: `__tests__/pwa-service-worker-build.test.ts`
- Test: `__tests__/pwa-service-worker-registration.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: authoritative offline acceptance text and an iPhone checklist that proves local boot separately from cloud sync.

- [ ] **Step 1: Update documentation**

In account-sync documentation, state that first online authentication enables cache-first local account boot on that device; network failure, token timeout and sync failure never turn it into guest. State that only explicit local data clearing or confirmed sign-out/account deletion hides the scope.

In quality/release documentation, add the four boot stages (15/45/75/100), determinate-percent rule, IndexedDB error/retry state, and 44px editor action grid.

In the iPhone checklist, add: online login → create/complete task → close PWA → Airplane Mode → open Home Screen app → status reaches 100% → verify email/data → create/complete a task → restore network → verify outbox synchronizes. Include a 92% ring visual check and first/additional block-date check.

- [ ] **Step 2: Run service-worker regressions**

Run: `node node_modules/jest/bin/jest.js --runInBand __tests__/pwa-service-worker-build.test.ts __tests__/pwa-service-worker-registration.test.ts`

Expected: PASS. No runtime API cache or navigation fallback is added; `skipWaiting` and `clientsClaim` remain disabled.

- [ ] **Step 3: Run complete targeted verification**

```bash
node node_modules/jest/bin/jest.js --runInBand __tests__/application/offline-account-recovery.test.ts __tests__/application/account-profile.test.ts __tests__/application/app-services.test.tsx __tests__/application/auth-gate.test.tsx
node node_modules/jest/bin/jest.js --runInBand __tests__/ui/app-boot-screen.test.tsx __tests__/ui/settings-screen.test.tsx __tests__/ui/plan-dashboard.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/task-planning-fields.test.tsx __tests__/ui/auth-screen.test.tsx
node node_modules/jest/bin/jest.js --runInBand __tests__/pwa-installation-assets.test.ts __tests__/pwa-service-worker-build.test.ts __tests__/pwa-service-worker-registration.test.ts
npm run typecheck
npm run lint
npm run web:export
node scripts/verify-qa-staging-config.cjs --env-file .env.local --dist dist
git diff --check
```

Expected: every command exits 0. If aggregate `npm test` retains the linked-worktree non-exit, report that limitation precisely and do not call it a passed full suite.

- [ ] **Step 4: Run the UI mechanical quality check**

Immediately before final handoff, run:

```bash
node C:/Users/Юлия/.codex/skills/impeccable/scripts/detect.mjs --json src/ui/primitives/app-boot-screen.tsx src/ui/auth/auth-screen.tsx src/ui/plan/progress-ring.tsx src/ui/backlog/item-form-sheet.tsx src/ui/backlog/task-planning-fields.tsx
```

Expected: no applicable mechanical quality findings; fix any applicable finding in the same change batch.

- [ ] **Step 5: Commit and push**

```bash
git add docs/tz/account-authentication-and-cloud-sync.md docs/tz/epic-09-quality-accessibility-and-release.md docs/testing/e11-t31-iphone-pwa-instructions.md
git commit -m "docs: define offline account startup acceptance"
git push
```

- [ ] **Step 6: Request staging approval**

Do not deploy automatically. Ask for a new explicit staging approval. After approval, run the guarded staging deployment and report immutable deployment identifier, commit SHA, HTTPS smoke result, and the iPhone checklist. Do not merge the branch or publish production.
