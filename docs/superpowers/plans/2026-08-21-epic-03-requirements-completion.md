# Epic 03 Requirements Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Epic 03 requirements for task date/period planning, conflict decisions, Backlog return history, recurrence instances, and calendar-boundary tests.

**Architecture:** Persist task calendar placement and transfer history in the same data-source/migration pattern as reminders and schedule blocks. Keep recurrence projection in the planning use cases, with one typed recurrence rule and occurrence state applicable to both tasks and reminders; UI consumes those results rather than duplicating date arithmetic. Conflict detection remains an atomic preflight, enriched with display labels before it reaches the confirmation dialog.

**Tech Stack:** TypeScript, Expo/React Native, SQLite/in-memory AppDataSource, Jest, TypeScript compiler.

**Spec:** `docs/requirements/ТЗ_iOS_планировщик_MVP.docx`, `docs/superpowers/specs/2026-08-08-plan-periods-task-create-design.md`

## Global Constraints

- Work only in `.worktrees/epic-03-resume` on `codex/epic-03-resume`; do not create or switch the main worktree branch.
- Do not extend MVP beyond T3.1.1, T3.1.4, T3.1.5, T3.2.1–T3.2.4.
- Do not add Outlook writes or request permissions above `Calendars.Read`.
- Each task uses test-first development, then only its target tests and `npm run typecheck`.
- After all four tasks, run one full test suite, lint, and final TЗ checklist.

---

### Task 1: Persist task calendar placement and transfer history

**Files:**
- Modify: `src/domain/entities.ts`, `src/data/contracts.ts`, `src/data/migrations.ts`, `src/data/data-source.native.ts`, `src/data/data-source.web.ts`
- Modify: `src/application/planning-types.ts`, `src/application/planning-use-cases.ts`, `src/ui/backlog/item-form-sheet.tsx`, `src/ui/plan/day-dashboard.tsx`
- Test: `__tests__/application/planning-use-cases.test.ts`, `__tests__/data/in-memory-data-source.test.ts`

**Interfaces:**
- Produces `TaskItem.scheduledOn`, `TaskItem.periodStartOn`, `TaskItem.periodEndOn` and `TransferHistory` persistence.
- Produces `returnTaskToBacklog(source, { taskId, reason? })` and plan rows for date-only/period tasks.

- [ ] Write failing tests that save a date-only task, project it on its date, project a period task for every date in range, and return it to Backlog while storing transfer history.
- [ ] Run only those tests and observe failures caused by absent placement/history state.
- [ ] Add model, schema migration, native/in-memory mapping, use-case transaction, and UI action using the produced interfaces.
- [ ] Run the Task 1 target tests and `npm run typecheck`.

### Task 2: Show named conflicts before saving

**Files:**
- Modify: `src/application/planning-types.ts`, `src/application/planning-use-cases.ts`, `src/ui/backlog/item-form-sheet.tsx`
- Test: `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/plan-task-create.test.tsx`

**Interfaces:**
- Replaces a bare conflicting `ScheduleBlock` payload with `ScheduleConflict` containing the candidate, conflicting block, item title, and interval.
- Preserves `forceConflicts` as the only transition that writes a conflicting task/reminder.

- [ ] Write failing use-case/UI tests requiring a conflict confirmation to list the blocking task title and retain explicit cancel/save choices.
- [ ] Run only those tests and observe the missing list content.
- [ ] Enrich conflict results from tasks, render them in the existing confirmation surface, and keep the atomic preflight unchanged.
- [ ] Run the Task 2 target tests and `npm run typecheck`.

### Task 3: Complete recurrence rules and independent scope operations

**Files:**
- Modify: `src/domain/entities.ts`, `src/domain/planning.ts`, `src/data/migrations.ts`, `src/data/data-source.native.ts`
- Modify: `src/application/planning-types.ts`, `src/application/planning-use-cases.ts`, `src/ui/backlog/task-planning-fields.tsx`, `src/ui/backlog/item-form-sheet.tsx`, `src/ui/plan/day-dashboard.tsx`
- Test: `__tests__/domain/planning.test.ts`, `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/recurrence-move.test.tsx`

**Interfaces:**
- Extends `RecurrenceRule` with `weeklyDays?: number[]` and frequency values `daily`, `weekly`, `monthly`, `yearly`, `intervalDays`.
- Produces occurrence projection/state for reminders as well as tasks, and a reusable scope decision dialog for edit/delete/move.

- [ ] Write failing tests for selected weekdays, yearly and every-N-days generation; independent reminder completion/cancellation; and scope behavior when changing/deleting a recurring item.
- [ ] Run only those tests and observe the unsupported rule/state failures.
- [ ] Implement validation, persistence, projection, state-aware reminder rows, and UI scope operations without duplicating recurrence calculation.
- [ ] Run the Task 3 target tests and `npm run typecheck`.

### Task 4: Prove calendar-boundary and local-time semantics

**Files:**
- Modify: `__tests__/domain/planning.test.ts`, `__tests__/application/planning-use-cases.test.ts`

**Interfaces:**
- Covers the existing recurrence/date and `timeZoneId` contracts without changing their public API unless the tests expose a defect.

- [ ] Write tests for end-of-month clamping, year rollover, leap-day recurrence, and moving a zoned block across DST while preserving its displayed local time.
- [ ] Run only those tests and observe the intended failure before any corrective production change.
- [ ] Make the minimal correction if a boundary case fails; otherwise retain the existing implementation.
- [ ] Run the Task 4 target tests and `npm run typecheck`.

### Task 5: Final Epic 03 verification

**Files:**
- Modify: this plan’s checkboxes only if required by execution tracking.

- [ ] Re-read T3.1.1–T3.2.4 and tick each requirement against its implementation and regression test.
- [ ] Run `npm test` once and inspect all suite results.
- [ ] Run `npm run lint` once and inspect all lint results.
- [ ] Run `git diff --check`, commit the scoped implementation, and push `codex/epic-03-resume`.
