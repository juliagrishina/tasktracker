# Epic 03 Scheduling, Recurrence and Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist task and reminder planning, handle recurring occurrences and conflicts, and calculate real Plan load on web and iPhone.

**Architecture:** Keep date/time business rules in pure domain modules and expose state changes only through planning use cases. Both data sources implement the same planning contract; SQLite is extended by an additive migration and the web source remains in-memory. Plan and form components consume selectors and use cases instead of demo percentages or local-only planning drafts.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript strict, Expo SQLite, Jest with React Native Testing Library.

## Global Constraints

- Implement only [Epic 03](../../tz/epic-03-scheduling-recurrence-and-calculations.md); do not add Outlook, notifications, archive, energy, drag-and-drop, a backend or user accounts.
- Store blocks as ISO 8601 timestamps with the device offset and use local calendar date parts for date-only planning and recurrence generation.
- A block start and end must be distinct, ordered and on a five-minute grid; the default duration is 60 minutes.
- Support daily, weekly and monthly recurrence with a positive integer interval. A changed or cancelled occurrence must not alter neighbouring occurrences when the user chooses “only this occurrence”.
- A reminder never owns a time block. It must be converted atomically into a task before a time block is saved.
- Load uses only own blocks in Epic 03: full overlapping minutes and blocks outside work hours count; the result is never capped; 0–50 is low, 51–70 medium and 71+ high.
- Keep Russian copy, touch targets at least 44 pt, existing design tokens and the four-tab navigation.
- Every production change starts with a failing automated test, followed by focused tests and one small commit. Push the current branch after each substantive commit.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/domain/entities.ts` | Shared planning, recurrence and occurrence entity types. |
| `src/domain/planning.ts` | Pure local-date parsing, block validation/defaults, conflict search, recurrence dates and load calculation. |
| `src/data/contracts.ts` | Repository-like planning methods shared by both data sources. |
| `src/data/migrations.ts` | SQLite migration 4 for task planning fields and recurrence occurrences. |
| `src/data/data-source.web.ts` / `src/data/data-source.native.ts` | In-memory and SQLite persistence for planning records. |
| `src/application/planning-types.ts` | Explicit inputs and read models used by UI. |
| `src/application/planning-use-cases.ts` | Transactional save, conflict, conversion, recurrence and Plan selector workflows. |
| `src/application/app-services-provider.tsx` | Supplies planning actions and refreshes Plan state after mutations. |
| `src/ui/backlog/task-planning-fields.tsx` | Controlled production fields for task and reminder scheduling. |
| `src/ui/backlog/item-form-sheet.tsx` | Saves planning and displays an explicit conflict decision. |
| `src/ui/plan/*` | Shows load based on real selector data rather than `plan-demo-model`. |
| `__tests__/domain/planning.test.ts` | Pure scheduling, calendar and load rules. |
| `__tests__/data/planning-data-source.test.ts` | In-memory persistence parity and deletion cascades. |
| `__tests__/application/planning-use-cases.test.ts` | Transactions, conversion, conflicts and occurrence independence. |
| `__tests__/ui/plan-task-create.test.tsx` / `__tests__/ui/plan-period-views.test.tsx` | User-visible save, conflict and actual percentage flows. |

## Task 1: Establish a deterministic test baseline

**Files:**
- Modify: none.
- Test: `__tests__/ui/plan-period-views.test.tsx`.

**Interfaces:**
- Consumes the committed `package-lock.json`.
- Produces a reproducible baseline command for all later tasks.

- [ ] **Step 1: Remove any non-lockfile dependency tree and install the lockfile state**

Run:

```powershell
Remove-Item -LiteralPath node_modules -Recurse -Force
npm.cmd ci --no-audit --no-fund
```

Expected: `node_modules` is recreated exclusively from `package-lock.json`.

- [ ] **Step 2: Reproduce the formerly red Plan menu test**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/ui/plan-period-views.test.tsx
```

Expected: all four tests pass; no production source change is made because the prior timeout was caused by a partial mixed `pnpm`/`npm` dependency tree.

- [ ] **Step 3: Record the baseline in the implementation report**

Record `npm ci` as the required clean-install command and do not create a commit because source files remain unchanged.

## Task 2: Define planning and recurrence domain rules

**Files:**
- Create: `src/domain/planning.ts`.
- Modify: `src/domain/entities.ts`, `src/domain/invariants.ts`.
- Create: `__tests__/domain/planning.test.ts`.
- Modify: `__tests__/domain/invariants.test.ts`.

**Interfaces:**
- Produces `PlanItemKind`, `PlanSchedule`, `RecurrenceSeries`, `RecurrenceOccurrence`, `createDefaultScheduleBlock`, `assertPlanningShape`, `findScheduleConflicts`, `getOccurrenceDates`, `getDayLoadPercent` and `getPlanLoadTone`.
- `ScheduleBlock` gains `occurrenceId: EntityId | null`; it remains owned by `taskItemId`.
- `TaskItem` gains `scheduledOn`, `periodStartOn` and `periodEndOn`, all `string | null`; `Reminder` retains its existing equivalent fields.

- [ ] **Step 1: Write failing pure-rule tests**

```ts
test('rounds the next block start up to the next five-minute boundary', () => {
  expect(createDefaultScheduleBlock('task-1', new Date('2026-08-05T09:01:00+03:00')))
    .toMatchObject({ startsAt: '2026-08-05T09:05:00+03:00', endsAt: '2026-08-05T10:05:00+03:00' });
});

test('counts an overlapping block and an outside-workday block in full', () => {
  expect(getDayLoadPercent({ workdayStartsAt: '08:00', workdayEndsAt: '22:00' }, [
    block('09:00', '10:00'), block('09:30', '10:30'), block('23:00', '24:00'),
  ], '2026-08-05')).toBe(21.428571428571427);
});
```

Add tests for malformed intervals, 5-minute validation in the local offset, exact thresholds 50/51/70/71, a weekly interval of two and a monthly series crossing February in a leap year.

- [ ] **Step 2: Run domain tests and verify the expected missing-module failure**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/domain/planning.test.ts __tests__/domain/invariants.test.ts
```

Expected: FAIL because `src/domain/planning.ts` and planning entity fields do not exist.

- [ ] **Step 3: Add the smallest isolated domain implementation**

```ts
export function getPlanLoadTone(percent: number): PlanLoadTone {
  if (percent <= 50) return 'low';
  if (percent <= 70) return 'medium';
  return 'high';
}

export function blocksOverlap(left: ScheduleBlock, right: ScheduleBlock): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}
```

Use calendar-part helpers (`year`, `month`, `day`) for recurrence dates; use timestamp instants only for block ordering and duration. Reject a period with only one boundary and reject an occurrence whose date precedes its series start.

- [ ] **Step 4: Run domain tests and type check**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/domain/planning.test.ts __tests__/domain/invariants.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the domain contract**

```powershell
git add src/domain/entities.ts src/domain/planning.ts src/domain/invariants.ts __tests__/domain/planning.test.ts __tests__/domain/invariants.test.ts
git commit -m "feat: add planning domain rules"
git push
```

## Task 3: Persist plans, series and occurrences in both data sources

**Files:**
- Modify: `src/data/contracts.ts`, `src/data/migrations.ts`, `src/data/data-source.web.ts`, `src/data/data-source.native.ts`.
- Create: `__tests__/data/planning-data-source.test.ts`.
- Modify: `__tests__/data/migrations.test.ts`.

**Interfaces:**
- Adds `listScheduleBlocksForTaskItem`, `deleteScheduleBlock`, `listRecurrenceSeries`, `deleteRecurrenceSeries`, `saveRecurrenceOccurrence`, `getRecurrenceOccurrence`, `listRecurrenceOccurrences` and `deleteRecurrenceOccurrence` to `AppDataSource`.
- `RecurrenceSeries` targets `{ itemKind: 'task' | 'reminder'; itemId: EntityId }`; `RecurrenceOccurrence` stores `{ id, seriesId, occursOn, status: 'active' | 'cancelled', createdAt }`.
- SQLite schema version 4 adds nullable `scheduled_on`, `period_start_on` and `period_end_on` columns to `task_items`; it keeps existing blocks and rehomes legacy series with `item_kind = 'task'` and `item_id = task_item_id`.

- [ ] **Step 1: Write failing persistence and migration tests**

```ts
test('removes blocks, a series and its occurrence when its task is deleted', async () => {
  await source.saveTaskItem(task);
  await source.saveScheduleBlock(block);
  await source.saveRecurrenceSeries(series);
  await source.saveRecurrenceOccurrence(occurrence);
  await source.deleteTaskItem(task.id);

  await expect(source.listScheduleBlocks()).resolves.toEqual([]);
  await expect(source.listRecurrenceSeries()).resolves.toEqual([]);
  await expect(source.listRecurrenceOccurrences()).resolves.toEqual([]);
});
```

Add a migration assertion that version 4 creates `recurrence_occurrences` and copies `task_item_id` into the rebuilt `recurrence_series` table.

- [ ] **Step 2: Run persistence tests and verify interface failures**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/data/planning-data-source.test.ts __tests__/data/migrations.test.ts
```

Expected: FAIL because recurrence occurrence methods and migration 4 do not exist.

- [ ] **Step 3: Implement migration 4 and parity methods**

```sql
CREATE TABLE recurrence_occurrences (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES recurrence_series(id) ON DELETE CASCADE,
  occurs_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL,
  UNIQUE(series_id, occurs_on)
);
```

Make the in-memory transaction snapshot include occurrences. Rebuild the SQLite `recurrence_series` table in migration 4, copy legacy data, add `scheduled_on`, `period_start_on` and `period_end_on` to `task_items`, and add `occurrence_id` to `schedule_blocks` with a nullable reference. Ensure list methods are sorted by creation time and all deletes behave identically in both implementations.

- [ ] **Step 4: Run source, migration and old data tests**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/data/planning-data-source.test.ts __tests__/data/migrations.test.ts __tests__/data/backlog-data-source.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit persistent planning data**

```powershell
git add src/data src/domain/entities.ts __tests__/data/planning-data-source.test.ts __tests__/data/migrations.test.ts
git commit -m "feat: persist planning series and occurrences"
git push
```

## Task 4: Implement transactional planning use cases

**Files:**
- Create: `src/application/planning-types.ts`, `src/application/planning-use-cases.ts`.
- Modify: `src/application/convert-reminder-to-task.ts`, `src/application/app-services-provider.tsx`.
- Create: `__tests__/application/planning-use-cases.test.ts`.
- Modify: `__tests__/application/convert-reminder-to-task.test.ts`, `__tests__/application/app-services.test.tsx`.

**Interfaces:**
- Produces `saveTaskPlanning(source, input)`, `saveReminderPlanning(source, input)`, `resolveScheduleConflict(source, input)`, `convertReminderAndSchedule(source, input)`, `saveOccurrenceException(source, input)` and `getPlanLoad(source, isoDate)`.
- `saveTaskPlanning` returns `{ conflict: null } | { conflict: ScheduleConflict[] }` before storing conflicting blocks; `resolveScheduleConflict` takes `decision: 'cancel' | 'save'`.
- `convertReminderAndSchedule` takes `projectId`, `taskId`, `block` and `createdAt` and preserves title, description, estimated duration, date, period and recurrence in one source transaction.

- [ ] **Step 1: Write failing use-case tests**

```ts
test('requires an explicit save decision when a new block conflicts', async () => {
  await source.saveTaskItem(existingTask);
  await source.saveScheduleBlock(existingBlock);

  await expect(saveTaskPlanning(source, { taskId: task.id, blocks: [conflictingBlock] }))
    .resolves.toMatchObject({ conflict: [expect.objectContaining({ block: existingBlock })] });
  await expect(source.getScheduleBlock(conflictingBlock.id)).resolves.toBeNull();
});

test('cancelling one recurrence occurrence leaves the following occurrence active', async () => {
  await saveOccurrenceException(source, { seriesId: series.id, occursOn: '2028-02-29', status: 'cancelled' });
  expect(getOccurrenceDates(series, '2028-02-01', '2028-03-31')).toContain('2028-03-31');
});
```

Add conversion coverage proving that a reminder is deleted only when the target task and first block have been saved, and load coverage for two overlapping blocks producing more than 100%.

- [ ] **Step 2: Run the new use-case tests and verify expected absence**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/application/planning-use-cases.test.ts __tests__/application/convert-reminder-to-task.test.ts
```

Expected: FAIL because planning use cases have not been exported.

- [ ] **Step 3: Implement use cases with one transaction per user action**

```ts
export async function resolveScheduleConflict(
  source: AppDataSource,
  input: ResolveScheduleConflictInput,
): Promise<void> {
  if (input.decision === 'cancel') return;
  await source.transaction(async () => {
    for (const block of input.blocks) await source.saveScheduleBlock(block);
  });
}
```

Before `saveTaskPlanning` writes any block, load existing own blocks and return sorted conflicts. Store a recurrence series only when the form supplies a repeat rule. For an occurrence-only action, save one `RecurrenceOccurrence`; never edit the series itself.

- [ ] **Step 4: Run application and regression tests**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/application/planning-use-cases.test.ts __tests__/application/convert-reminder-to-task.test.ts __tests__/application/app-services.test.tsx __tests__/application/backlog-use-cases.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit planning workflows**

```powershell
git add src/application src/data/contracts.ts __tests__/application
git commit -m "feat: add planning use cases"
git push
```

## Task 5: Replace local-only scheduling fields with real form actions

**Files:**
- Modify: `src/ui/backlog/task-planning-fields.tsx`, `src/ui/backlog/item-form-sheet.tsx`, `src/ui/backlog/confirmation.ts`, `src/application/app-services-provider.tsx`.
- Modify: `__tests__/ui/plan-task-create.test.tsx`, `__tests__/ui/backlog-form.test.tsx`.

**Interfaces:**
- `TaskPlanningFields` returns a validated `TaskPlanningDraft` containing date/period/repeat and zero or more `ScheduleBlockDraft`s.
- `ItemFormSheet` calls `planningActions.saveTaskPlanning` after core item creation or update and retains its current form state when a conflict is returned.
- `Confirmation` receives conflict title strings and invokes the explicit `'save'` or `'cancel'` decision.
- Editing an occurrence supplied with a `seriesId` presents `'Только этот экземпляр'` and `'Всю серию'`; the former calls `saveOccurrenceException`, while the latter changes the `RecurrenceSeries` rule.

- [ ] **Step 1: Add UI tests for persistence and conflict choice**

```tsx
test('keeps a conflicting block unsaved until the user confirms it', async () => {
  fireEvent.press(view.getByText('Создать'));
  await waitFor(() => expect(view.getByText('Пересечение в расписании')).toBeOnTheScreen());
  expect(await source.getScheduleBlock('new-block')).toBeNull();

  fireEvent.press(view.getByText('Сохранить с пересечением'));
  await waitFor(() => expect(source.getScheduleBlock('new-block')).resolves.not.toBeNull());
});
```

Add a reminder-form test that selecting a time offers conversion, creates the selected task under the chosen project or without one, and removes the original reminder only after confirmation.

Add a recurring-task test that changes the 29 February 2028 occurrence, chooses `Только этот экземпляр`, and asserts that the 31 March 2028 occurrence still follows the unchanged series rule.

- [ ] **Step 2: Run UI tests and verify current demo-only behaviour fails them**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/ui/plan-task-create.test.tsx __tests__/ui/backlog-form.test.tsx
```

Expected: FAIL because the sheet currently saves core fields but no planning records.

- [ ] **Step 3: Connect the sheet to planning actions without changing visual structure**

```tsx
const result = await planningActions.saveTaskPlanning({ taskId, draft: planningDraft });
if (result.conflict !== null) {
  setPendingConflict(result.conflict);
  return;
}
onClose();
```

Generate block IDs at the sheet boundary, pass the actual current time to the default-block helper and present conflict titles via the existing confirmation surface. Keep Backlog creation without planning valid and preserve blank-title validation.
When a draft is opened for one recurrence occurrence, render the two scope actions before applying the edit; do not infer a scope from the user’s last choice.

- [ ] **Step 4: Run form, action and provider regressions**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/ui/plan-task-create.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx __tests__/application/app-services.test.tsx
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit real scheduling from forms**

```powershell
git add src/ui/backlog src/application/app-services-provider.tsx __tests__/ui/plan-task-create.test.tsx __tests__/ui/backlog-form.test.tsx
git commit -m "feat: save planning from task forms"
git push
```

## Task 6: Drive Day, Week and Month from real load selectors

**Files:**
- Create: `src/application/plan-load-selector.ts`.
- Modify: `src/ui/plan/plan-period-model.ts`, `src/ui/plan/plan-screen.tsx`, `src/ui/plan/day-dashboard.tsx`, `src/ui/plan/week-load-list.tsx`, `src/ui/plan/month-load-grid.tsx`, `src/application/app-services-provider.tsx`.
- Modify: `__tests__/ui/plan-period-model.test.ts`, `__tests__/ui/plan-period-views.test.tsx`, `__tests__/ui/plan-dashboard.test.tsx`.

**Interfaces:**
- `getPlanLoadDays(source, selectedDate, mode)` returns the same `PlanLoadDay[]` shape now consumed by Week and Month, using `getPlanLoad` rather than `demoLoadByIsoDate`.
- `getDayPlan(source, isoDate)` returns `{ untimedTasks, untimedReminders, blocks, loadPercent, tone }` for the day dashboard.
- `AppServicesContextValue` exposes refreshed `plan` state and `refreshPlan()`.

- [ ] **Step 1: Write failing selector and screen tests**

```ts
test('updates the week percentage after a persisted 15-hour block', async () => {
  await planningActions.resolveScheduleConflict({ blocks: [fifteenHourBlock], decision: 'save' });
  await expect(getPlanLoadDays(source, '2026-08-05', 'week'))
    .resolves.toContainEqual(expect.objectContaining({ isoDate: '2026-08-05', loadPercent: 107.14285714285714, tone: 'high' }));
});
```

Add a PlanScreen test that saves a titled task with a block, moves to Week, then sees its computed percentage rather than the fixed 104% demo value. Keep the existing date-to-Day tests.

- [ ] **Step 2: Run selector and Plan tests to verify demo values fail the new assertions**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/ui/plan-period-model.test.ts __tests__/ui/plan-period-views.test.tsx __tests__/ui/plan-dashboard.test.tsx
```

Expected: FAIL because `plan-period-model.ts` reads a fixed percentage map.

- [ ] **Step 3: Replace demo load reads with selector data**

```ts
export async function getPlanLoadDays(
  source: AppDataSource,
  selectedDate: string,
  mode: 'week' | 'month',
): Promise<readonly PlanLoadDay[]> {
  const isoDates = getPeriodDates(selectedDate, mode);
  const percentages = await Promise.all(isoDates.map((isoDate) => getPlanLoad(source, isoDate)));
  return isoDates.map((isoDate, index) => toPlanLoadDay(isoDate, percentages[index]));
}
```

Resolve the promises before rendering, keep Week Monday-first and keep Month cells to date plus exact percentage only. Day uses the same selector for real blocks and items without a fixed time. Delete only the fixed percentage map; retain presentation helpers and tokens.

- [ ] **Step 4: Run Plan and integration tests**

Run:

```powershell
npm.cmd test -- --runTestsByPath __tests__/ui/plan-period-model.test.ts __tests__/ui/plan-period-views.test.tsx __tests__/ui/plan-dashboard.test.tsx __tests__/ui/plan-task-create.test.tsx
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 5: Commit real Plan load data**

```powershell
git add src/application/plan-load-selector.ts src/application/app-services-provider.tsx src/ui/plan __tests__/ui
git commit -m "feat: show real plan load"
git push
```

## Task 7: Complete verification and acceptance documentation

**Files:**
- Modify: `README.md`, `docs/testing/epic-03-manual-checklist.md`.
- Modify only if a verification failure reveals a defect in files from Tasks 2–6.
- Test: all `__tests__/`.

**Interfaces:**
- Consumes the completed data source, use cases, forms and selectors.
- Produces a reproducible browser acceptance path and accurate documentation of the web/iPhone boundary.

- [ ] **Step 1: Write the manual acceptance checklist**

Include this exact browser sequence: create task → add two five-minute-grid blocks → save; create an overlapping block → cancel then save with overlap; create date/period/repeating reminder; convert a timed reminder; cancel a single recurring instance; move through Day/Week/Month and verify exact percentage including over 100 %. State that web data resets on refresh and SQLite persistence requires iPhone verification.

- [ ] **Step 2: Run the entire automated suite**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run web:export
```

Expected: every command exits 0; test output has no timeouts and `web:export` emits static routes.

- [ ] **Step 3: Inspect browser output at mobile width**

Run:

```powershell
npm.cmd run web
```

At 390 px, execute the checklist. Confirm visible focus on web, 44 pt targets, conflict actions, no source-local colour literals and no horizontal scroll. At a wide viewport confirm the temporary centred mobile composition remains intact.

- [ ] **Step 4: Commit verification documentation and any necessary narrow fix**

```powershell
git add README.md docs/testing/epic-03-manual-checklist.md src __tests__
git diff --cached --quiet || git commit -m "docs: verify epic 03 planning"
git push
```

## Plan self-review

- Domain validation and pure calendar/load logic are covered by Task 2.
- SQLite and browser parity plus non-destructive migration are covered by Task 3.
- Conflict, reminder conversion and independent recurring occurrences are covered by Task 4.
- The plan form’s real writes and explicit user conflict choice are covered by Task 5.
- Day, Week and Month consuming one persisted source of truth are covered by Task 6.
- Browser and iPhone boundaries, complete automation and final manual regression are covered by Task 7.
