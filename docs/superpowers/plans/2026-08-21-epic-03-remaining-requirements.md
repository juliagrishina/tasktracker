# Epic 03 Remaining Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining functional gaps in the current Epic 03 scheduling, recurrence and browser-plan implementation.

**Architecture:** Preserve the existing application/domain split. Extend recurrence exceptions so an untimed occurrence can be moved independently, keep reminder recurrence data lossless through conversion, and feed each plan view from real scheduled blocks and settings rather than static presentation values. The UI remains a thin adapter over application use cases.

**Tech Stack:** TypeScript, React Native/Expo, Jest, local data sources and SQLite migrations.

**Spec:** `docs/tz/epic-03-scheduling-recurrence-and-calculations.md`

## Global Constraints

- Implement only Epic 03 requirements from `docs/tz/`.
- Do not add Outlook writes or permissions above `Calendars.Read`.
- Keep exact schedule instants with an explicit time zone; use UTC only to backfill already zone-less persisted data.
- Run target tests and typecheck after every task; run the full suite and lint once after all tasks.

---

### Task 1: Correct default block rollover and require a persisted time zone

**Files:**
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Modify: `src/domain/entities.ts`, `src/data/migrations.ts`, data sources and affected fixtures
- Test: `__tests__/ui/plan-task-create.test.tsx`, `__tests__/domain/planning.test.ts`, `__tests__/data/migrations.test.ts`

- [x] Write failing tests for the 23:56–23:59 rollover and non-null persisted zone.
- [x] Run the target tests and confirm the expected failures.
- [x] Move the default date forward at midnight; enforce/backfill an explicit zone without altering instant values.
- [x] Run target tests and typecheck.

### Task 2: Preserve reminder recurrence and convert timed reminders atomically

**Files:**
- Modify: `src/application/planning-use-cases.ts`, `src/application/planning-types.ts`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Test: `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/backlog-form.test.tsx`

- [x] Write failing tests for weekday persistence, conversion of an existing reminder, and recurrence retained after timed conversion.
- [x] Run the target tests and confirm the expected failures.
- [x] Persist `weekdays`, introduce the minimal conversion input for an existing reminder, and create the resulting task recurrence in the same transaction.
- [x] Run target tests and typecheck.

### Task 3: Move untimed recurring occurrences independently

**Files:**
- Modify: `src/application/planning-use-cases.ts`, `src/application/planning-types.ts`
- Modify: `src/ui/plan/day-dashboard.tsx` and recurrence dialog components as needed
- Test: `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/recurrence-move.test.tsx`

- [x] Write failing tests for moving a date-only recurring task and reminder while leaving its source and sibling instances unchanged.
- [x] Run the target tests and confirm the expected failures.
- [x] Project moved occurrence patches on the target date and expose the existing scope chooser for both untimed kinds.
- [x] Run target tests and typecheck.

### Task 4: Project real load data in every browser plan view and refresh it after mutation

**Files:**
- Modify: `src/application/planning-use-cases.ts`, `src/application/app-services-provider.tsx`
- Modify: `src/ui/plan/plan-period-model.ts`, `src/ui/plan/plan-screen.tsx`, `src/ui/plan/day-dashboard.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Test: `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/plan-dashboard.test.tsx`, `__tests__/ui/plan-period-views.test.tsx`

- [x] Write failing tests proving day/week/month values come from stored blocks and update after a plan mutation.
- [x] Run the target tests and confirm the expected failures.
- [x] Add a real load projection use case, inject it into period views, and refresh plan state after saves/removals.
- [x] Run target tests and typecheck.

### Task 5: Final Epic 03 verification and delivery

- [x] Re-read `docs/tz/epic-03-scheduling-recurrence-and-calculations.md` and map every requirement to implementation/tests.
- [x] Run `npm test -- --silent`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check`.
- [ ] Commit the scoped implementation and push `codex/epic-03-resume`.
