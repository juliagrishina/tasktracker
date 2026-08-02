# Epic 01 completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Epic 01 requirements: complete local persistence, cross-platform invariants, reminder conversion, and development demo data on iPhone and web.

**Architecture:** `AppDataSource` becomes the complete, platform-neutral persistence contract. The domain validates relationships before every save; SQLite triggers remain a second defence. `AppServicesProvider` seeds fixed development data and exposes already-loaded presentation data to tabs, so the UI never imports SQLite or platform-specific storage.

**Tech Stack:** React Native, Expo Router, Expo SQLite, TypeScript strict, Jest, React Native Testing Library.

## Global Constraints

- Keep all labels in Russian except the approved title `Backlog`.
- Use Expo SQLite only on iPhone and in-memory storage only on web; do not add network calls, authentication, iCloud, Microsoft 365, a backend, or additional dependencies.
- Development builds seed test data idempotently; production builds preserve the original empty first-day Plan.
- Preserve the four tabs and their order: «План», `Backlog`, «Завершённые», «Настройки».
- All additions follow TDD: a focused test must fail before production code is written.

---

### Task 1: Complete the domain contract and relationship rules

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/domain/invariants.ts`
- Create: `src/domain/reminder-conversion.ts`
- Modify: `src/data/contracts.ts`
- Test: `__tests__/domain/invariants.test.ts`
- Create: `__tests__/domain/reminder-conversion.test.ts`

**Interfaces:**
- Produces `assertTaskItemParent(task: TaskItem, parent: TaskItem | null): void`.
- Produces `createTaskFromReminder(reminder: Reminder, taskId: EntityId, createdAt: string): TaskItem`.
- Extends `AppDataSource` with `save/get` operations for `Reminder`, `ScheduleBlock`, `RecurrenceSeries`, `CompletedItem` and `saveSettings`; `deleteReminder(id)` removes an original reminder after conversion.

- [ ] **Step 1: Write failing domain tests**

```ts
test('rejects a subtask whose parent is another subtask', () => {
  expect(() => assertTaskItemParent(child, subtaskParent)).toThrow('родителем подзадачи может быть только задача');
});

test('creates a standalone task from a reminder', () => {
  expect(createTaskFromReminder(reminder, 'task-2', createdAt)).toMatchObject({
    id: 'task-2', kind: 'task', projectId: null, parentTaskId: null, title: reminder.title,
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm.cmd test -- __tests__/domain/invariants.test.ts __tests__/domain/reminder-conversion.test.ts`  
Expected: failing imports because the parent validator and conversion function do not exist.

- [ ] **Step 3: Implement the minimal domain API**

Add a required `title` to `Reminder`. Make `assertTaskItemParent` reject a missing parent, a non-task parent and self-parenting. Create the conversion function without timestamps inferred from the device: the caller supplies both identifiers and creation time.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- __tests__/domain/invariants.test.ts __tests__/domain/reminder-conversion.test.ts`  
Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/data/contracts.ts __tests__/domain
git commit -m "feat: complete domain persistence contract"
```

### Task 2: Implement complete web and SQLite persistence

**Files:**
- Modify: `src/data/data-source.web.ts`
- Modify: `src/data/data-source.native.ts`
- Modify: `src/data/migrations.ts`
- Test: `__tests__/data/in-memory-data-source.test.ts`
- Create: `__tests__/data/migrations.test.ts`

**Interfaces:**
- Consumes the expanded `AppDataSource` from Task 1.
- Produces persistence and retrieval of every entity type in both data sources.
- Produces migration version 2 that adds `title` to existing `reminders` rows without deleting version-1 data.

- [ ] **Step 1: Write failing persistence and migration tests**

```ts
test('preserves every entity and changed settings after reinitialization', async () => {
  await source.saveReminder(reminder);
  await source.saveSettings({ ...defaults, notificationLeadMinutes: 15 });
  await source.initialize();
  await expect(source.getReminder(reminder.id)).resolves.toEqual(reminder);
  await expect(source.getSettings()).resolves.toMatchObject({ notificationLeadMinutes: 15 });
});

test('runs migration two after an existing version-one database', async () => {
  await migrateDatabase(versionOneDatabase);
  expect(versionOneDatabase.executedSql).toContain('ALTER TABLE reminders ADD COLUMN title');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm.cmd test -- __tests__/data/in-memory-data-source.test.ts __tests__/data/migrations.test.ts`  
Expected: tests fail because the data source lacks methods and migration version 2.

- [ ] **Step 3: Implement minimal storage parity**

Add `Map` collections and methods to the web source. Add typed rows and parameterized SQL methods to the native source. Before saving a subtask, load its parent and call `assertTaskItemParent` in both sources. In migrations, keep version 1 intact and append version 2 with `ALTER TABLE reminders ADD COLUMN title TEXT NOT NULL DEFAULT ''`; execute every missing version inside the existing transaction.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- __tests__/data/in-memory-data-source.test.ts __tests__/data/migrations.test.ts`  
Expected: all entity types and settings persist in the in-memory source; migration runner issues only missing migrations.

- [ ] **Step 5: Commit**

```bash
git add src/data __tests__/data
git commit -m "feat: persist all epic 01 entities locally"
```

### Task 3: Add the reminder conversion use case

**Files:**
- Create: `src/application/convert-reminder-to-task.ts`
- Create: `__tests__/application/convert-reminder-to-task.test.ts`

**Interfaces:**
- Consumes `AppDataSource` and `createTaskFromReminder`.
- Produces `convertReminderToTask(source, { reminderId, taskId, createdAt }): Promise<TaskItem>`.

- [ ] **Step 1: Write the failing use-case test**

```ts
test('replaces a stored reminder with a standalone task', async () => {
  const task = await convertReminderToTask(source, conversionInput);
  expect(task.title).toBe('Позвонить в страховую');
  await expect(source.getReminder(conversionInput.reminderId)).resolves.toBeNull();
  await expect(source.getTaskItem(conversionInput.taskId)).resolves.toEqual(task);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd test -- __tests__/application/convert-reminder-to-task.test.ts`  
Expected: failing import because the use case does not exist.

- [ ] **Step 3: Implement the minimal use case**

Load the reminder, throw a Russian error if it is absent, build a root task via the domain helper, save it, remove the reminder and return the saved task. Do not create a schedule block or user-interface flow in this epic.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm.cmd test -- __tests__/application/convert-reminder-to-task.test.ts`  
Expected: task exists with the original title and reminder is absent.

- [ ] **Step 5: Commit**

```bash
git add src/application/convert-reminder-to-task.ts __tests__/application/convert-reminder-to-task.test.ts
git commit -m "feat: convert reminders into tasks"
```

### Task 4: Seed and expose development demo data

**Files:**
- Modify: `src/application/app-services-provider.tsx`
- Create: `src/application/demo-data.ts`
- Modify: `src/ui/demo-tasks.ts`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/app/(tabs)/backlog.tsx`
- Modify: `src/app/(tabs)/completed.tsx`
- Modify: `src/app/(tabs)/settings.tsx`
- Test: `__tests__/application/app-services.test.tsx`
- Create: `__tests__/application/demo-data.test.ts`
- Modify: `__tests__/ui/demo-tasks.test.ts`

**Interfaces:**
- Produces `seedDemoData(source): Promise<void>` and `loadDemoTaskGroups(source): Promise<DemoTaskGroups>`.
- Extends `AppServicesContextValue` with `demoTasks` and the loaded settings.
- Screens consume `useAppServices()` only; they do not import platform APIs or a data source.

- [ ] **Step 1: Write failing seed and UI-data tests**

```ts
test('seeds every entity once and exposes cards for each task tab', async () => {
  await seedDemoData(source);
  await seedDemoData(source);
  await expect(source.getCompletedItem('demo-completed-review-completion')).resolves.not.toBeNull();
  await expect(loadDemoTaskGroups(source)).resolves.toMatchObject({
    plan: [{ title: 'Подготовить черновик недели' }],
    backlog: [{ title: 'Разобрать входящие заметки' }],
    completed: [{ title: 'Заполнить итоги дня' }],
  });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm.cmd test -- __tests__/application/demo-data.test.ts __tests__/ui/demo-tasks.test.ts`  
Expected: failing imports because seed and load functions do not exist.

- [ ] **Step 3: Implement the minimal development flow**

Create fixed demo entities using stable IDs and `save` operations. In the provider, seed only when `__DEV__` is true, load data after initialization, and expose it to tabs. Remove `Platform.OS` demo branching so iPhone and web show the same cards in development. Keep empty state when the provider exposes no plan items. On Settings, show the stored notification lead as a readable setting; remove the developer storage diagnostic because automatic seed/restart is now the persistence check.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- __tests__/application/demo-data.test.ts __tests__/application/app-services.test.tsx __tests__/ui/demo-tasks.test.ts`  
Expected: stable IDs prevent duplicate logical records and all three task sections receive cards.

- [ ] **Step 5: Commit**

```bash
git add src/application src/ui src/app __tests__/application __tests__/ui
git commit -m "feat: seed development tasks on every platform"
```

### Task 5: Document physical iPhone verification and run the full suite

**Files:**
- Modify: `docs/testing/epic-01-manual-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Documents the exact Expo Go acceptance steps for iPhone running iOS 26 and the browser command.

- [ ] **Step 1: Update the manual checklist**

Replace the diagnostic-button steps with: start Expo Go, verify portrait Russian tabs and demo cards, close and relaunch Expo Go, check the same cards and setting remain, then enable airplane mode and reopen the app. State that browser data resets only after page refresh.

- [ ] **Step 2: Run the complete verification suite**

Run each command independently:

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run web:export
```

Expected: zero failed tests, zero TypeScript errors, zero lint errors and static routes for all four tabs.

- [ ] **Step 3: Inspect the final worktree**

Run: `git diff --check` and `git status --short`  
Expected: no whitespace errors; only intended documentation changes before committing.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/testing/epic-01-manual-checklist.md
git commit -m "docs: document epic 01 acceptance checks"
```
