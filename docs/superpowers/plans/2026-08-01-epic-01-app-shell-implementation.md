# Epic 01 — App Shell and Local Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Russian, offline-first Expo app shell with four tabs, a browser prototype, and local data that is persistent on iPhone and in-memory on web.

**Architecture:** Expo Router contains routes only. The UI receives typed repositories from an application provider and never imports SQLite. Domain rules are pure TypeScript. One `AppDataSource` interface has a native Expo SQLite implementation with migrations and a browser in-memory implementation with the same interface.

**Tech Stack:** React Native, Expo SDK 54 Tabs template, Expo Router, TypeScript strict, Expo SQLite, Jest with jest-expo, React Native Testing Library, ESLint.

## Global Constraints

- Target iPhone is iOS 26+ in portrait orientation; all user-visible text is Russian except the approved tab name `Backlog`.
- `npm run web` is a mandatory delivery path. Web is an interactive prototype with temporary in-memory data; persistent storage is accepted on iPhone only.
- Tab order is «План», `Backlog`, «Завершённые», «Настройки» and the first route is «План».
- Keep `strict: true`; do not use `any` or import `expo-sqlite` from a route or UI component.
- Do not add accounts, server calls, iCloud, Microsoft 365, Outlook, notifications, SecureStore, search, filters, task CRUD UI, analytics or drag-and-drop.
- Work at `C:\Users\admin\Documents\Codex\2026-08-01\new-chat\tasktracker`; never overwrite `docs/`.
- Before implementation code, write and run the stated test to observe the intended failure. Make the smallest production change, rerun the test, then refactor only while it stays green.
- Commit locally after Tasks 1, 3, 5 and 6. Do not push; the user pushes manually.

---

### Task 1: Bootstrap an Expo Tabs project without overwriting documentation

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`, `jest.setup.ts`, `eslint.config.js`
- Create: `assets/` files from the Expo Tabs template
- Modify: `.gitignore`

**Interfaces:**
- Produces scripts `start`, `web`, `web:export`, `lint`, `typecheck` and `test`.
- Produces a strict TypeScript/Jest environment used by all later tasks.

- [ ] **Step 1: Generate the approved template in a temporary directory**

Run from the parent workspace, not the repository:

```powershell
npx create-expo-app@latest 'C:\Users\admin\Documents\Codex\2026-08-01\new-chat\work\epic-01-expo-template' --template tabs@sdk-54 --yes
```

Copy the generated configuration files, `package.json`, lockfile and `assets/` into `tasktracker`. Do not copy the template's sample routes: Tasks 4–5 create the actual routes with `apply_patch`.

- [ ] **Step 2: Configure scripts, strict TypeScript and Jest**

Keep the template's Expo SDK 54-compatible dependencies. Add these scripts to `package.json`:

```json
{
  "start": "expo start",
  "web": "expo start --web",
  "web:export": "expo export --platform web",
  "lint": "expo lint",
  "typecheck": "tsc --noEmit",
  "test": "jest --runInBand"
}
```

Set `compilerOptions.strict` to `true`. Set `jest.config.js` to `preset: 'jest-expo'`, `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`, and `testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)']`. In `jest.setup.ts`, import `@testing-library/react-native/extend-expect`.

- [ ] **Step 3: Install required packages and write ignore rules**

Run:

```powershell
npx expo install expo-sqlite
npm install --save-dev jest-expo @types/jest @testing-library/react-native
```

Ignore `.expo/`, `node_modules/`, `coverage/` and local environment files. Keep source, configuration, `package-lock.json` and the generated assets tracked.

- [ ] **Step 4: Verify the bootstrap before committing**

Run:

```powershell
npm run typecheck
npm run lint
npm test -- --passWithNoTests
npm run web:export
```

Expected: each command exits with code 0; zero tests is expected at this point.

- [ ] **Step 5: Commit the bootstrap**

```powershell
git add package.json package-lock.json app.json tsconfig.json babel.config.js jest.config.js jest.setup.ts eslint.config.js .gitignore assets
git commit -m "chore: bootstrap Expo app shell"
```

### Task 2: Define the domain types and invariant guards through TDD

**Files:**
- Create: `src/domain/entities.ts`
- Create: `src/domain/invariants.ts`
- Create: `__tests__/domain/invariants.test.ts`

**Interfaces:**
- Produces `EntityId`, `Project`, `TaskItem`, `Reminder`, `ScheduleBlock`, `RecurrenceSeries`, `CompletedItem` and `AppSettings`.
- Produces `assertTaskItemShape`, `assertReminderShape` and `assertScheduleBlockShape` for use by repositories and migrations.

- [ ] **Step 1: Write the failing tests for the four boundaries**

Create `__tests__/domain/invariants.test.ts` with fixed IDs and ISO dates. The test suite must include these assertions:

```ts
expect(() => assertTaskItemShape({ ...task, kind: 'task', parentTaskId: 'parent' }))
  .toThrow('Задача верхнего уровня не может иметь родителя');
expect(() => assertTaskItemShape({ ...task, kind: 'subtask', parentTaskId: null }))
  .toThrow('Подзадача должна ссылаться на задачу-родителя');
expect(() => assertReminderShape({ ...reminder, projectId: 'project-1' }))
  .toThrow('Напоминание не может относиться к проекту');
expect(() => assertScheduleBlockShape({ ...block, startsAt: '2026-08-01T09:03:00.000Z' }, task))
  .toThrow('Время блока должно иметь шаг пять минут');
```

- [ ] **Step 2: Run the test and observe RED**

Run `npm test -- __tests__/domain/invariants.test.ts`.

Expected: failure because `entities.ts` and `invariants.ts` do not yet exist.

- [ ] **Step 3: Implement the smallest domain model**

Use this discriminated shape for tasks:

```ts
export type TaskItem =
  | { id: EntityId; kind: 'task'; projectId: EntityId | null; parentTaskId: null; title: string; createdAt: string }
  | { id: EntityId; kind: 'subtask'; projectId: EntityId | null; parentTaskId: EntityId; title: string; createdAt: string };
```

`Reminder` always has `projectId: null`. A block can belong only to a task or subtask, its end is after its start, and both minutes are divisible by five. Keep internal lifecycle state out of display labels.

- [ ] **Step 4: Run the test and observe GREEN**

Run `npm test -- __tests__/domain/invariants.test.ts`.

Expected: all four invariant cases pass.

### Task 3: Add the data-source interface, migrations and platform implementations

**Files:**
- Create: `src/data/contracts.ts`
- Create: `src/data/default-settings.ts`
- Create: `src/data/migrations.ts`
- Create: `src/data/data-source.native.ts`
- Create: `src/data/data-source.web.ts`
- Create: `__tests__/data/default-settings.test.ts`
- Create: `__tests__/data/in-memory-data-source.test.ts`

**Interfaces:**
- Produces `AppDataSource` with `initialize`, `getSettings`, `saveProject`, `getProject`, `saveTaskItem` and `getTaskItem` methods, all returning `Promise` values.
- Produces `createDataSource()` through `data-source.native.ts` and `data-source.web.ts`; Metro chooses the extension by platform.
- Produces `getDefaultSettings()` with 08:00–22:00, 21:00 and 10-minute defaults.

- [ ] **Step 1: Write failing data-source tests**

Write tests that call a real `createInMemoryDataSource()` with no mocks:

```ts
test('creates default settings only once', async () => {
  const source = createInMemoryDataSource();
  await source.initialize();
  await source.initialize();
  await expect(source.getSettings()).resolves.toMatchObject({
    workdayStartsAt: '08:00', workdayEndsAt: '22:00', eveningReviewAt: '21:00', notificationLeadMinutes: 10,
  });
  expect(source.debugSettingsRowCount()).toBe(1);
});

test('returns a saved project and task after reinitialization', async () => {
  const source = createInMemoryDataSource();
  await source.initialize();
  await source.saveProject(project);
  await source.saveTaskItem(task);
  await source.initialize();
  await expect(source.getProject(project.id)).resolves.toEqual(project);
  await expect(source.getTaskItem(task.id)).resolves.toEqual(task);
});
```

`debugSettingsRowCount` is permitted only for this data-source test file and must not be exposed by UI code.

- [ ] **Step 2: Run the data-source tests and observe RED**

Run `npm test -- __tests__/data/default-settings.test.ts __tests__/data/in-memory-data-source.test.ts`.

Expected: failure because the source and default settings do not exist.

- [ ] **Step 3: Implement schema version one and both sources**

The native migration enables foreign keys and runs in a transaction. Create `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`, `settings`, `projects`, `task_items`, `reminders`, `schedule_blocks`, `recurrence_series` and `completed_items`. `settings` has `id INTEGER PRIMARY KEY CHECK (id = 1)` and defaults are inserted with `INSERT OR IGNORE`.

Use `CHECK` clauses for kind/parent shape and SQLite triggers to reject a subtask parent that is not a top-level task. Do not create Outlook, token or sync tables. The web source uses Maps, preserves them across repeated `initialize()` calls, and resets only after a browser refresh.

- [ ] **Step 4: Run data-source tests and commit**

Run:

```powershell
npm test -- __tests__/data/default-settings.test.ts __tests__/data/in-memory-data-source.test.ts
npm run typecheck
npm run lint
git add src/domain src/data __tests__/domain __tests__/data
git commit -m "feat: add local data source foundation"
```

Expected: the tests, typecheck and lint exit with code 0.

### Task 4: Add repositories, a dependency provider and initialization state

**Files:**
- Create: `src/data/repositories/project-repository.ts`
- Create: `src/data/repositories/settings-repository.ts`
- Create: `src/application/app-services.ts`
- Create: `src/application/app-services-provider.tsx`
- Create: `src/application/persistence-diagnostic.ts`
- Create: `__tests__/application/app-services.test.tsx`
- Create: `__tests__/application/persistence-diagnostic.test.ts`

**Interfaces:**
- Produces `ProjectRepository.save(project)` and `ProjectRepository.findById(id)`.
- Produces `SettingsRepository.get()`.
- Produces `<AppServicesProvider source?: AppDataSource>` and `useAppServices()` returning `{ isReady, projects, settings }`.
- Produces `runPersistenceDiagnostic(source): Promise<'created' | 'persisted'>`, available only to the development-only UI in Task 5.

- [ ] **Step 1: Write a failing provider test**

Render a real in-memory source through a probe component:

```tsx
test('shows loading before initialization and exposes default settings after it', async () => {
  render(
    <AppServicesProvider source={createInMemoryDataSource()}>
      <ServicesProbe />
    </AppServicesProvider>,
  );
  expect(screen.getByText('loading')).toBeOnTheScreen();
  expect(await screen.findByText('08:00–22:00')).toBeOnTheScreen();
});
```

`ServicesProbe` calls `useAppServices()` and contains no mock implementation.

- [ ] **Step 2: Run the provider test and observe RED**

Run `npm test -- __tests__/application/app-services.test.tsx`.

Expected: failure because the provider and repositories do not exist.

- [ ] **Step 3: Implement provider and repositories**

Repositories delegate only to `AppDataSource`. The provider calls `source.initialize()` once in an effect, exposes `isReady: false` while waiting, and renders a Russian non-fatal initialization error if the promise rejects. When no `source` prop is passed, it imports `createDataSource` from `src/data/data-source`; Metro resolves the web or native implementation.

- [ ] **Step 4: Run the provider test and observe GREEN**

Run `npm test -- __tests__/application/app-services.test.tsx`.

Expected: the probe shows `loading`, then `08:00–22:00`.

- [ ] **Step 5: Write a failing persistence-diagnostic test**

Create this test using a real in-memory data source:

```ts
test('reports persisted when the diagnostic record already exists', async () => {
  const source = createInMemoryDataSource();
  await source.initialize();
  await expect(runPersistenceDiagnostic(source)).resolves.toBe('created');
  await expect(runPersistenceDiagnostic(source)).resolves.toBe('persisted');
});
```

- [ ] **Step 6: Run the diagnostic test and observe RED**

Run `npm test -- __tests__/application/persistence-diagnostic.test.ts`.

Expected: failure because `runPersistenceDiagnostic` does not yet exist.

- [ ] **Step 7: Implement and verify the diagnostic**

`runPersistenceDiagnostic` reads one fixed development-only project ID. If absent, it saves a project and task with that ID and returns `created`; if present, it returns `persisted`. It does not delete production data or appear in release builds. Run `npm test -- __tests__/application/persistence-diagnostic.test.ts` and expect it to pass.

### Task 5: Implement the four-tab app shell and browser routes

**Files:**
- Create: `src/app/_layout.tsx`
- Create: `src/app/(tabs)/_layout.tsx`
- Create: `src/app/(tabs)/index.tsx`
- Create: `src/app/(tabs)/backlog.tsx`
- Create: `src/app/(tabs)/completed.tsx`
- Create: `src/app/(tabs)/settings.tsx`
- Create: `src/ui/screen-shell.tsx`
- Create: `src/ui/empty-plan-state.tsx`
- Create: `src/ui/tab-definitions.ts`
- Create: `src/ui/development-storage-diagnostic.tsx`
- Create: `__tests__/ui/tab-definitions.test.ts`
- Create: `__tests__/ui/empty-plan-state.test.tsx`

**Interfaces:**
- Produces exactly four `tabDefinitions`: `index/План`, `backlog/Backlog`, `completed/Завершённые`, `settings/Настройки`.
- Produces `ScreenShell` and `EmptyPlanState` used by route components.
- The root layout wraps navigation in `AppServicesProvider`.

- [ ] **Step 1: Write failing UI tests**

Create a tab test:

```ts
expect(tabDefinitions).toEqual([
  { route: 'index', title: 'План' },
  { route: 'backlog', title: 'Backlog' },
  { route: 'completed', title: 'Завершённые' },
  { route: 'settings', title: 'Настройки' },
]);
```

Create an empty-plan test:

```tsx
render(<EmptyPlanState today={new Date('2026-08-01T09:00:00.000Z')} />);
expect(screen.getByText('План на сегодня')).toBeOnTheScreen();
expect(screen.getByText('Первое дело появится в Backlog')).toBeOnTheScreen();
```

- [ ] **Step 2: Run the UI tests and observe RED**

Run `npm test -- __tests__/ui/tab-definitions.test.ts __tests__/ui/empty-plan-state.test.tsx`.

Expected: failure because the route support components do not exist.

- [ ] **Step 3: Implement the shared components and routes**

`src/app/_layout.tsx` wraps `(tabs)` in `AppServicesProvider`. The tab layout maps `tabDefinitions` to `Tabs.Screen` declarations and sets `initialRouteName` to `index`. Use the approved route titles and template icon package.

`index.tsx` renders the current localized date and `EmptyPlanState`, but no task-creation button. The other routes render their title and a neutral Russian statement that the section will be completed in its corresponding epic. `settings.tsx` additionally renders `DevelopmentStorageDiagnostic` only when `__DEV__` is true; it invokes `runPersistenceDiagnostic` and reports its Russian result. All routes must use the real Expo Router tab bar in native and web builds.

- [ ] **Step 4: Run UI tests and static checks**

Run:

```powershell
npm test -- __tests__/ui/tab-definitions.test.ts __tests__/ui/empty-plan-state.test.tsx
npm test
npm run typecheck
npm run lint
npm run web:export
```

Expected: all tests pass and the static web export exits with code 0.

- [ ] **Step 5: Manually verify the browser prototype**

Run `npm run web`, open the Expo URL in a Windows browser, and verify:

1. «План» opens first with the current date and the empty state.
2. The four approved labels appear in the prescribed order.
3. Each tab opens without an Expo error overlay.
4. Refreshing the page does not show a login, Microsoft 365 controls or Outlook data.

Stop the local server after the check.

- [ ] **Step 6: Commit the app shell**

```powershell
git add src/app src/ui src/application src/data/repositories __tests__/application __tests__/ui
git commit -m "feat: add four-tab app shell"
```

### Task 6: Document manual verification and run the final regression checks

**Files:**
- Create: `docs/testing/epic-01-manual-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Produces repeatable browser and Expo Go checks for Epic 01.
- Documents the difference between temporary browser data and persistent iPhone SQLite data.

- [ ] **Step 1: Write the manual checklist and README commands**

The checklist must contain these exact manual actions:

```markdown
1. Run `npm run web` on Windows and open the Expo URL.
2. Confirm «План», `Backlog`, «Завершённые`, «Настройки» appear in that order.
3. Open every tab and refresh the browser; confirm no login or Microsoft 365 controls appear.
4. Run `npm start`, open the project in Expo Go on iPhone, and visit all four tabs.
5. In the development-only diagnostic on «Настройки», run the storage check, restart Expo Go, run it again and confirm the result changes from «Тестовые данные созданы» to «Локальное хранение подтверждено».
```

README must document `npm install`, `npm run web`, `npm start`, `npm test`, `npm run typecheck` and `npm run lint`. It must state that browser data is temporary and SQLite persistence is accepted on iPhone.

- [ ] **Step 2: Run the complete verification set**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run web:export
git diff --check
git status --short
```

Expected: all commands exit 0, `git diff --check` is silent, and only the intended files remain before staging.

- [ ] **Step 3: Commit verification materials**

```powershell
git add README.md docs/testing/epic-01-manual-checklist.md
git commit -m "docs: add epic 01 verification checklist"
```

## Final acceptance checklist

- [ ] `npm run web` opens an interactive browser prototype with the same four tabs.
- [ ] The browser starts on «План» and has no Microsoft 365 UI.
- [ ] Expo SQLite persists iPhone data while browser data is temporary.
- [ ] Domain guards reject invalid task hierarchy, project-bound reminders and non-five-minute blocks.
- [ ] Default settings are written once and saved project/task records survive reinitialization.
- [ ] Routes have no direct SQLite imports, server calls, login UI or iCloud code.
- [ ] Tests, typecheck, lint and static web export pass.
- [ ] The repository contains the manual browser and iPhone acceptance checklist.
