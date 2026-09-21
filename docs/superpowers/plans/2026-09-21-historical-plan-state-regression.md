# Historical Plan State Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each day’s evening-review state and keep a completed planned task in both its original plan date and the matching completed-archive date.

**Architecture:** The plan screen will load the daily-energy entry by the currently selected ISO date instead of reusing the global current-day entry. Completed items retain `completedAt` as the audit timestamp, but gain a separate `displayDate` used only for archive filtering, grouping, and the row date; one-time planned tasks derive that date from their planned block. The day-plan reader must independently retain a completed task’s schedule block when the requested plan date matches that block.

**Tech Stack:** TypeScript, React Native / Expo, Jest, Testing Library, in-memory `AppDataSource`.

**Spec:** `docs/superpowers/specs/2026-08-22-epic-04-canonical-day-plan-design.md`; `docs/superpowers/plans/2026-08-28-epic-05-completion-corrections.md`

## Global Constraints

- The historic file `docs/requirements/ТЗ_iOS_планировщик_MVP.docx` is not a source of requirements and must not be read or changed.
- A completed task remains in the plan of the selected day with its completed visual marker and also appears in «Завершённые».
- `completedAt` remains the actual completion instant; it must not be rewritten to make an item appear on a planned date.
- Daily energy continues to be stored by ISO date in the account data source and synchronized with the account.
- Do not expand MVP scope, add Outlook writes, or request permissions above `Calendars.Read`.
- All user-facing dates follow the selected plan date and the saved plan time zone.
- Run targeted Jest tests, `npm run typecheck`, and `npm run lint` before committing; do not commit secrets or local sessions.

## Review Focus

- A task planned for 15 September and completed on 21 September stays visible and marked completed in the 15 September timeline; covered in Task 1.
- A completed unplanned task remains grouped by its actual completion date; covered in Task 2.
- A recurring occurrence completed after its planned date remains grouped by `occursOn`, without changing its actual `completedAt`; covered in Task 2.
- The archive’s rolling period filters and its row/group date use the same display date, including a non-UTC saved time zone; covered in Task 2.
- Opening evening review for a historic date never renders current-day energy or «сегодня» copy; covered in Task 3.

---

## File Structure

- `src/application/planning-use-cases.ts` keeps schedule blocks in the day where they are planned, even after the task is completed later.
- `src/application/completed-use-cases.ts` exposes a separate `displayDate` for archive presentation while preserving `completedAt` for audit details.
- `src/ui/completed/completed-history-screen.tsx` filters, groups, and dates archive rows by `displayDate`.
- `src/application/energy-use-cases.ts` reads energy for an explicitly selected ISO date.
- `src/application/app-services-provider.tsx` exposes the date-specific energy read through plan actions.
- `src/ui/plan/day-dashboard.tsx` loads the selected day’s energy with its evening-review items.
- `src/ui/plan/evening-review-dialog.tsx` labels the selected date and hides the current-day editor for historic dates.

### Task 1: Retain completed one-time blocks in the original day plan

**Files:**
- Modify: `src/application/planning-use-cases.ts:630-655`
- Test: `__tests__/application/planning-use-cases.test.ts`

**Interfaces:**
- Consumes: `getDateInTimeZone(instant, timeZoneId): string` and `doesScheduleBlockOverlapDate(block, isoDate): boolean`.
- Produces: `getPlanScheduleBlocks(source, isoDate): Promise<readonly ScheduleBlock[]>` that returns a completed task’s block when the block overlaps `isoDate`, regardless of the later `completedAt` date.

- [x] **Step 1: Write the failing test**

Add a test that saves a non-recurring task with a `2026-09-15T17:00:00+03:00` block, completes it at `2026-09-21T14:34:00.000Z`, and expects `getPlanScheduleBlocks(source, '2026-09-15')` to contain that block while `getPlanScheduleBlocks(source, '2026-09-21')` does not gain it.

```ts
await expect(getPlanScheduleBlocks(source, '2026-09-15')).resolves.toEqual([
  expect.objectContaining({ id: 'sync-block', taskItemId: 'sync-task' }),
]);
await expect(getPlanScheduleBlocks(source, '2026-09-21')).resolves.toEqual([]);
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runTestsByPath __tests__/application/planning-use-cases.test.ts`

Expected: FAIL because the completed task is currently admitted only when `completedAt` falls on the requested date.

- [x] **Step 3: Implement the minimal filter correction**

Replace the completed-task condition in `getPlanScheduleBlocks` so that a task is included when it is active or it has a non-recurring schedule block whose local block date overlaps the requested `isoDate`.

```ts
const taskIds = new Set(tasks.filter((task) =>
  task.completedAt === null || blocks.some((block) =>
    block.taskItemId === task.id
      && block.occurrenceId === null
      && doesScheduleBlockOverlapDate(block, isoDate),
  ),
).map((task) => task.id));
```

Do not change `completedAt`; the timeline’s existing completed-state lookup will mark the retained block as completed.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --runTestsByPath __tests__/application/planning-use-cases.test.ts`

Expected: PASS, including existing recurring-instance coverage.

- [x] **Step 5: Commit the isolated behaviour**

```bash
git add src/application/planning-use-cases.ts __tests__/application/planning-use-cases.test.ts
git commit -m "fix: retain completed blocks in their planned day"
```

### Task 2: Give completed archive entries a planned display date

**Files:**
- Modify: `src/application/completed-use-cases.ts:11-95`
- Modify: `src/ui/completed/completed-history-screen.tsx:146-175`
- Test: `__tests__/application/completed-use-cases.test.ts`
- Test: `__tests__/ui/completed-history-screen.test.tsx`

**Interfaces:**
- Consumes: `ScheduleBlock`, `getDateInTimeZone`, and the `CompletedItem` `completedAt` audit field.
- Produces: `CompletedItem.displayDate: string` in `YYYY-MM-DD` form. Recurring entries use `occurrence.occursOn`; a one-time task with blocks uses the earliest local date of its blocks; projects, reminders, subtasks without a plan, and unplanned tasks use the local date of `completedAt`.

- [x] **Step 1: Write the failing application tests**

Create a task scheduled in a 15 September block and complete it on 21 September. Assert that the result preserves its actual completion instant and exposes the planned display date. Add a second unplanned completed task to pin the fallback.

```ts
expect(completed.find((item) => item.id === 'sync-task')).toMatchObject({
  completedAt: '2026-09-21T14:34:00.000Z',
  displayDate: '2026-09-15',
});
expect(completed.find((item) => item.id === 'backlog-task')).toMatchObject({
  displayDate: '2026-09-21',
});
```

Also make the existing recurring-occurrence assertion require `displayDate: '2026-08-10'` when `completedAt` is deliberately later than `occursOn`.

- [x] **Step 2: Write the failing archive UI test**

Provide `CompletedHistoryScreen` with a planned item whose `completedAt` is 21 September and `displayDate` is 15 September. Select the period that includes the display date and assert the group heading and right-side row date are `15 сент.`, not `21 сент.`.

```ts
expect(view.getByText('15 сент.')).toBeOnTheScreen();
expect(view.queryByText('21 сент.')).toBeNull();
```

- [x] **Step 3: Run both focused test files to verify failure**

Run: `npm test -- --runTestsByPath __tests__/application/completed-use-cases.test.ts __tests__/ui/completed-history-screen.test.tsx`

Expected: FAIL because `CompletedItem` has no `displayDate`, and the screen derives groups from `completedAt`.

- [x] **Step 4: Implement the archive display-date model**

In `completed-use-cases.ts`:

```ts
export interface CompletedItem {
  // existing fields
  completedAt: string;
  displayDate: string;
}
```

Load schedule blocks with the current source data. Add a focused helper that resolves the archive date in this order:

```ts
function getCompletedDisplayDate(
  completedAt: string,
  blocks: readonly ScheduleBlock[],
  timeZoneId: string,
): string {
  return [...blocks]
    .map((block) => getDateInTimeZone(block.startsAt, block.timeZoneId))
    .sort()[0] ?? getDateInTimeZone(completedAt, timeZoneId);
}
```

Pass that value only for completed one-time tasks; map recurrent entries to `occurrence.occursOn`. Use `displayDate` for archive sorting and `isInCompletedPeriod`, retaining `completedAt` in details and permanent-deletion rules.

In `completed-history-screen.tsx`, replace the `Date.now()` timestamp cutoff and `item.completedAt.slice(0, 10)` group key with a date-only rolling cutoff and `item.displayDate`. Render `formatDate(item.displayDate)` in the row.

- [x] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/application/completed-use-cases.test.ts __tests__/ui/completed-history-screen.test.tsx`

Expected: PASS; details continue to say when the task was actually completed.

- [x] **Step 6: Commit the archive correction**

```bash
git add src/application/completed-use-cases.ts src/ui/completed/completed-history-screen.tsx __tests__/application/completed-use-cases.test.ts __tests__/ui/completed-history-screen.test.tsx
git commit -m "fix: group planned completions by plan date"
```

### Task 3: Bind evening review to the selected day

**Files:**
- Modify: `src/application/energy-use-cases.ts:17-45`
- Modify: `src/application/app-services-provider.tsx:95-110, 335-380`
- Modify: `src/ui/plan/day-dashboard.tsx:80-105, 250-265, 495`
- Modify: `src/ui/plan/evening-review-dialog.tsx:7-43`
- Test: `__tests__/application/energy-use-cases.test.ts`
- Test: `__tests__/ui/energy-check-in.test.tsx`

**Interfaces:**
- Consumes: `AppDataSource.getDailyEnergyEntry(recordedOn)` and selected `isoDate`.
- Produces: `getDailyEnergyForDate(source, isoDate): Promise<DailyEnergyEntry | null>` and `PlanningActions.getDailyEnergyForDate(isoDate)`.
- Produces: `EveningReviewDialog` props `reviewDate: string`, `isCurrentDay: boolean`, and date-specific `energy`.

- [x] **Step 1: Write the failing energy use-case test**

Save entries for 15 September (58%) and 21 September (10%). Assert the new date-specific reader returns 58% for 15 September and does not consult the current date.

```ts
await expect(getDailyEnergyForDate(source, '2026-09-15')).resolves.toMatchObject({
  recordedOn: '2026-09-15', energyPercent: 58,
});
```

- [x] **Step 2: Write the failing plan UI test**

Render `PlanScreen` with a selected 15 September plan and entries for both dates. Open «Открыть вечернюю проверку» and assert that it says `Незавершённые дела на 15.09.2026`, `Энергия за 15.09.2026`, and `58%`; assert it does not render the current-day energy editor.

```ts
expect(view.getByText('Энергия за 15.09.2026')).toBeOnTheScreen();
expect(view.getByText('58%')).toBeOnTheScreen();
expect(view.queryByLabelText('Изменить оценку энергии')).toBeNull();
```

- [x] **Step 3: Run the focused tests to verify failure**

Run: `npm test -- --runTestsByPath __tests__/application/energy-use-cases.test.ts __tests__/ui/energy-check-in.test.tsx`

Expected: FAIL because energy currently has only a current-day reader and the dialog hard-codes «сегодня».

- [x] **Step 4: Implement date-scoped read and dialog presentation**

Add the direct reader without changing current-day save semantics:

```ts
export function getDailyEnergyForDate(source: AppDataSource, isoDate: string) {
  return source.getDailyEnergyEntry(isoDate);
}
```

Expose it through `PlanningActions`. In `DayDashboard.openEveningReview`, load the review items and date-specific energy together, store the latter in local dialog state, and determine `isCurrentDay` from the selected date and saved time zone. Pass the selected ISO date to `EveningReviewDialog` and format it with `formatPlanDayHeaderDate` (which already returns `DD.MM.YYYY`).

Update dialog copy to be date-specific:

```tsx
<Text style={styles.description}>Незавершённые дела на {formattedDate}</Text>
<Text style={styles.energyTitle}>Энергия за {formattedDate}</Text>
```

Pass `onEditEnergy` only for today. Historic review is view-only; this avoids accidentally changing the current day while reviewing the past.

- [x] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- --runTestsByPath __tests__/application/energy-use-cases.test.ts __tests__/ui/energy-check-in.test.tsx`

Expected: PASS for both current-day editing and historic read-only review.

- [x] **Step 6: Commit the evening-review correction**

```bash
git add src/application/energy-use-cases.ts src/application/app-services-provider.tsx src/ui/plan/day-dashboard.tsx src/ui/plan/evening-review-dialog.tsx __tests__/application/energy-use-cases.test.ts __tests__/ui/energy-check-in.test.tsx
git commit -m "fix: show evening review for selected date"
```

### Task 4: Verify the integrated regression fix and document it

**Files:**
- Modify: `docs/superpowers/specs/2026-08-22-epic-04-canonical-day-plan-design.md`
- Modify: `docs/superpowers/plans/2026-09-21-historical-plan-state-regression.md`

**Interfaces:**
- Consumes: the completed changes from Tasks 1–3.
- Produces: a committed, pushed correction with an explicit regression note in the active plan design.

- [x] **Step 1: Add a concise regression note to the active design**

Append a short “Сохранение истории” paragraph stating that a completed planned item remains in the plan date defined by its block and is archived under that planned date, while the actual completion timestamp remains available in details. State that evening review reads the selected date’s incomplete items and energy.

- [x] **Step 2: Run the complete relevant verification**

Run: `npm test -- --runTestsByPath __tests__/application/planning-use-cases.test.ts __tests__/application/completed-use-cases.test.ts __tests__/application/energy-use-cases.test.ts __tests__/ui/completed-history-screen.test.tsx __tests__/ui/energy-check-in.test.tsx`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: all commands exit 0.

- [x] **Step 3: Inspect the final diff**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors and only intended source, test, and documentation changes.

- [ ] **Step 4: Commit and push the documented correction**

```bash
git add docs/superpowers/specs/2026-08-22-epic-04-canonical-day-plan-design.md docs/superpowers/plans/2026-09-21-historical-plan-state-regression.md
git commit -m "docs: define historical plan state"
git push
```

## Self-Review

1. **Spec coverage:** The canonical day-plan requirement for coherent selected-day data is covered by Tasks 1 and 3; the explicitly agreed Epic 05 rule that completed tasks remain in their planned day is covered by Tasks 1 and 2. No historic MVP document was used.
2. **Placeholder scan:** The plan contains concrete target files, signatures, test inputs, commands, and expected outcomes; no deferred implementation placeholders remain.
3. **Type consistency:** `displayDate` is introduced in Task 2 and used by its UI task. `getDailyEnergyForDate` is introduced in Task 3 and exposed through `PlanningActions` before the dashboard consumes it.
4. **Review focus:** Each listed case has a named owning task and explicit test expectation; in particular, the old-plan/new-completion regression, unplanned fallback, recurrence, rolling period, and historic energy are pinned.
