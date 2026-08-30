# Plan polish follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make planning time values readable, preserve the chosen plan date, give clear post-planning feedback, and improve compact Plan UI states.

**Architecture:** Reuse one duration-formatting and one value-picker positioning rule across task and reminder forms. Keep scheduling rules in planning helpers, while route-level state owns the success screen and navigation to the actual planned date. Plan list, timeline and month components receive only presentation-specific changes.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, React Native Testing Library.

**Spec:** User-approved in-chat scope dated 2026-08-30: seven numbered plan UX corrections only.

## Global Constraints

- Apply only the seven user-approved items; do not modify Outlook, drag-and-drop, loading calculations, or unrelated E6 flows.
- Preserve stored durations in minutes; only labels change.
- Use the effective application time zone and 5-minute increments.
- Implement one shared behaviour for web and iPhone through existing React Native components.
- Per task run target tests and `npm run typecheck`; do not run unrelated lint/full-suite checks.

---

### Task 1: Render durations in hours and minutes

**Files:**
- Create: `src/ui/format-duration.ts`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Modify: `src/app/(tabs)/backlog/item/[id].tsx`
- Test: `__tests__/ui/format-duration.test.ts`

- [ ] Write a failing table-driven test for `55`, `60`, `65`, `120` and `150` minutes.
- [ ] Verify it fails because `formatDuration` does not exist.
- [ ] Implement `formatDuration(minutes: number): string` with literals such as `2 ч 30 мин`.
- [ ] Use it for estimate, block-duration options and Backlog details without changing values persisted as strings/minutes.
- [ ] Run the new test and typecheck.

### Task 2: Preserve the current plan date for a newly created task

**Files:**
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Test: `__tests__/ui/plan-task-create.test.tsx`

- [ ] Write a failing form test that opens creation with `defaultDate: '2026-09-01'` and saves no time block.
- [ ] Verify the task placement is `scheduledOn: '2026-09-01'` rather than null.
- [ ] Initialize the planning draft from `planningContext.defaultDate` with `scheduleMode: 'date'` and no blocks.
- [ ] Keep the explicit «Без даты» user choice available.
- [ ] Run the target test and typecheck.

### Task 3: Clarify untimed list rows

**Files:**
- Modify: `src/ui/plan/day-dashboard.tsx`
- Test: `__tests__/ui/plan-dashboard.test.tsx`

- [ ] Write a failing row test that no longer finds «Точно запланировано» for an active untimed entry and verifies the «Без времени» label is bounded to two lines.
- [ ] Implement optional list details so active untimed entries have no misleading subtitle; preserve «Выполнено» for completed entries.
- [ ] Give the time column a stable width that allows «Без времени» to wrap to two lines.
- [ ] Run the target test and typecheck.

### Task 4: Show planning success and navigate to the actual planned date

**Files:**
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/app/(tabs)/backlog/item/[id].tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/ui/plan/plan-screen.tsx`
- Test: `__tests__/ui/backlog-planning-success.test.tsx`

- [ ] Write a failing route-level test for a task planned on `2026-09-01`: it must show its real title, success copy and a transition action.
- [ ] Add a typed planning-result callback carrying `{ itemTitle, itemType, plannedOn }` before Backlog refresh removes the item from the active view.
- [ ] Render the green-check success state and route «Перейти к дате» to Plan with `initialDate` equal to `plannedOn`.
- [ ] Support task, subtask and reminder labels, never generic «Элемент».
- [ ] Run the target test and typecheck.

### Task 5: Center time pickers and find a real free slot

**Files:**
- Modify: `src/ui/backlog/planning-value-picker.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/domain/planning.ts`
- Test: `__tests__/domain/planning.test.ts`
- Test: `__tests__/ui/task-planning-fields.test.tsx`
- Test: `__tests__/ui/planning-value-picker.test.tsx`

- [ ] Write failing domain tests for a 60-minute task where the next rounded clock time conflicts and the first free 5-minute slot is later.
- [ ] Implement a pure helper that searches working hours from the current/selected date and returns the first non-conflicting start, or `null`.
- [ ] Use the helper when adding a time block; if no suitable gap exists, retain the date-only placement and show an explicit message instead of moving days or forcing a conflict.
- [ ] Make `PlanningValuePicker` calculate `initialScrollIndex` from its selected option so reminder time, task start and duration open around their current values.
- [ ] Run the target tests and typecheck.

### Task 6: Keep task titles in narrow timeline blocks

**Files:**
- Modify: `src/ui/plan/day-timeline.tsx`
- Test: `__tests__/ui/day-timeline.test.tsx`

- [ ] Write a failing test for a 30-minute block that exposes its title but not the duplicate time text.
- [ ] Derive `hasRoomForTime` from rendered block height and render the title unconditionally.
- [ ] Preserve the full time range in the accessibility label.
- [ ] Run the target test and typecheck.

### Task 7: Make today unmistakable in Month

**Files:**
- Modify: `src/ui/plan/month-load-grid.tsx`
- Test: `__tests__/ui/plan-today-highlights.test.tsx`

- [ ] Extend the failing Month test to distinguish a filled blue today badge from the previous small dot.
- [ ] Render the day number in a filled primary circle with inverse text when it is today; retain selected-date border semantics.
- [ ] Run the target test and typecheck.

## Coverage review

- Duration labels: Task 1.
- Plan-day date default: Task 2.
- Untimed copy and two-line label: Task 3.
- Success confirmation and actual-date navigation: Task 4.
- Value picker positioning and nearest free slot: Task 5.
- Narrow-block title priority: Task 6.
- Month today circle: Task 7.
