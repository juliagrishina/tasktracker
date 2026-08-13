# Epic 03 completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Epic 03 so all scheduled and unscheduled work affects the plan correctly, repeats have independent instances, and planning can be performed with calendar and picker controls.

**Architecture:** Preserve the current domain/application/data/UI layering. Extend the recurrence exception contract and persist it identically in SQLite and in-memory storage; calculate load from exact blocks plus derived untimed contributions. Replace free-text planning controls with reusable picker primitives while keeping the existing Expo/React Native token system and the atomic reminder-to-task conversion.

**Tech Stack:** TypeScript, Expo 54, React Native 0.81, Expo SQLite, Jest, React Native Testing Library.

## Global Constraints

- Scope is only Epic 03; do not add Outlook writes, notifications, archive, drag-and-drop, or actual-time tracking.
- Outlook permissions remain at most `Calendars.Read`.
- Exact times and durations use a five-minute grid; date display is `ДД.ММ.ГГГГ`.
- Date, period, recurrence, time and estimate must be validated before persistence and again in domain/use-case code.
- Day load includes exact blocks and estimates of dated/period/repeating entries without exact time; never count one entry twice.
- A period distributes its estimate across all included days, preserving the total after minute rounding.
- Recurrence supports only `daily`, `weekly`, and `monthly`, and an individual instance can be moved, cancelled, or completed without changing the series.
- No user data is deleted by migration; SQLite and browser data source have the same uniqueness rule for `(seriesId, occursOn)`.
- Preserve current design tokens and provide 44×44pt touch targets, accessible labels and visible inline errors.

---

### Task 1: Recurrence and schedule persistence contract

**Files:**
- Modify: `src/domain/entities.ts`, `src/domain/invariants.ts`, `src/domain/planning.ts`
- Modify: `src/data/contracts.ts`, `src/data/data-source.web.ts`, `src/data/data-source.native.ts`, `src/data/migrations.ts`
- Modify: `__tests__/domain/planning.test.ts`, `__tests__/domain/invariants.test.ts`, `__tests__/data/planning-data-source.test.ts`, `__tests__/data/in-memory-data-source.test.ts`, `__tests__/data/migrations.test.ts`

**Interfaces:**
- Produces `ReminderOccurrencePatch`, `RecurrenceOccurrence.status` including `completed`, `completedAt`, and `ScheduleBlock.timeZoneId`.
- Produces identical persistence round-tripping and uniqueness enforcement for both sources.

- [ ] **Step 1: Write failing tests for one completed occurrence, one reminder patch, duplicate occurrence rejection, and time-zone round-trip.**

```ts
await source.saveRecurrenceOccurrence({ ...occurrence, status: 'completed', completedAt: '2026-08-13T08:00:00.000Z' });
await expect(source.saveRecurrenceOccurrence({ ...occurrence, id: 'duplicate' })).rejects.toThrow('экземпляр');
```

- [ ] **Step 2: Run the focused domain/data tests and confirm the failures name the missing status, patch, zone or duplicate guard.**

Run: `npm test -- --runInBand __tests__/data/planning-data-source.test.ts __tests__/data/in-memory-data-source.test.ts __tests__/data/migrations.test.ts __tests__/domain/invariants.test.ts`

- [ ] **Step 3: Add the entity fields, migration v6, SQLite row conversion and in-memory duplicate guard.**

```ts
status: 'active' | 'cancelled' | 'completed';
completedAt: string | null;
timeZoneId: string | null;
```

- [ ] **Step 4: Add and use zone-aware local-date helpers for block overlap, clipping and recurrence projection, with legacy ISO-offset fallback.**

- [ ] **Step 5: Re-run focused tests; commit `feat: persist complete recurrence exceptions`.**

### Task 2: Validated planning, recurrence projection and load calculation

**Files:**
- Modify: `src/application/planning-types.ts`, `src/application/planning-use-cases.ts`, `src/application/plan-load-selector.ts`
- Modify: `src/domain/planning.ts`
- Modify: `__tests__/application/planning-use-cases.test.ts`, `__tests__/ui/plan-period-model.test.ts`, `__tests__/domain/planning.test.ts`

**Interfaces:**
- Produces `saveOccurrenceException` that accepts task or reminder patch and a completed status.
- Produces `getPlanLoad(source, isoDate)` with exact-block and untimed-estimate contributions, and `getDayPlan` entries carrying their occurrence context.

- [ ] **Step 1: Write failing tests for a date-only estimate, period distribution, recurring untimed estimate, midnight block split, moved/cancelled/completed occurrence and a reminder occurrence patch.**

```ts
await expect(getPlanLoad(source, '2026-08-12')).resolves.toBeCloseTo(50);
await expect(getDayPlan(source, '2026-08-19')).resolves.toMatchObject({ untimed: [{ occurrence: { occursOn: '2026-08-12' } }] });
```

- [ ] **Step 2: Run the focused application/domain tests and confirm each fails for its intended absent behavior.**

Run: `npm test -- --runInBand __tests__/application/planning-use-cases.test.ts __tests__/ui/plan-period-model.test.ts __tests__/domain/planning.test.ts`

- [ ] **Step 3: Centralize valid date/range/recurrence checks and apply them before saving task, reminder and occurrence changes.**

- [ ] **Step 4: Project series and overrides into untimed plan entries, suppress their source dates, and exclude cancelled/completed instances.**

- [ ] **Step 5: Sum exact block minutes once, then add only estimates of entries without an exact block; distribute period estimates with deterministic remainder allocation.**

- [ ] **Step 6: De-duplicate candidate conflict reports, rerun focused tests, and commit `feat: calculate complete epic 03 plan load`.**

### Task 3: Reusable calendar and value picker planning controls

**Files:**
- Create: `src/ui/backlog/planning-date-picker.tsx`, `src/ui/backlog/planning-value-picker.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`, `src/ui/design/tokens.ts`
- Modify: `__tests__/ui/task-planning-fields.test.ts`

**Interfaces:**
- Produces `PlanningDatePicker` with `value`, `onChange`, `accessibilityLabel` and month navigation.
- Produces `PlanningValuePicker` for five-minute time/duration choices.
- Keeps `TaskPlanningDraft` serializable and makes `createScheduleBlocksFromDraft` include `timeZoneId`.

- [ ] **Step 1: Write failing UI tests that open a date calendar, choose a day, choose start/end time and choose an estimate without typing.**

```tsx
fireEvent.press(screen.getByRole('button', { name: 'Дата задачи' }));
fireEvent.press(screen.getByRole('button', { name: '15 августа 2026' }));
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scheduledOn: '2026-08-15' }));
```

- [ ] **Step 2: Run the focused UI test and confirm it fails because those controls do not yet exist.**

Run: `npm test -- --runInBand __tests__/ui/task-planning-fields.test.ts`

- [ ] **Step 3: Implement token-based modal pickers with 44pt targets, clear selected state, keyboard/accessibility labels, and a calendar month grid.**

- [ ] **Step 4: Replace raw date/time/duration inputs with the new controls and fold exact intervals into the single «Планирование» surface.**

- [ ] **Step 5: Preserve and hydrate date, period, estimate and existing blocks in draft helpers; rerun focused UI tests and commit `feat: add calendar planning controls`.**

### Task 4: Form, backlog and plan workflows

**Files:**
- Modify: `src/ui/backlog/item-form-sheet.tsx`, `src/ui/backlog/item-detail-actions.tsx`
- Modify: `src/app/(tabs)/backlog/item/[id].tsx`, `src/ui/plan/plan-screen.tsx`, `src/ui/plan/day-dashboard.tsx`
- Modify: `src/application/app-services-provider.tsx`
- Modify: `__tests__/ui/backlog-form.test.tsx`, `__tests__/ui/backlog-actions.test.tsx`, `__tests__/ui/plan-task-create.test.tsx`, `__tests__/ui/plan-dashboard.test.tsx`

**Interfaces:**
- `ItemFormSheet.planningContext` carries task or reminder recurrence instance context and an existing hydrated draft.
- Backlog action invokes the editor; a no-time reminder can be planned; exact time still calls the existing conversion action.

- [ ] **Step 1: Write failing UI tests for backlog «Запланировать», a planned reminder without time, editing a date-only task, and completing/moving one recurrence instance.**

```tsx
fireEvent.press(screen.getByRole('button', { name: 'Запланировать' }));
expect(screen.getByText('Планирование')).toBeTruthy();
```

- [ ] **Step 2: Run the focused form and plan tests and confirm the prior placeholder/lost-draft behavior fails the assertions.**

Run: `npm test -- --runInBand __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx __tests__/ui/plan-task-create.test.tsx __tests__/ui/plan-dashboard.test.tsx`

- [ ] **Step 3: Route backlog planning to the form, hydrate all persisted planning values, and use «Сохранить» for edits.**

- [ ] **Step 4: Make reminder planning use the same date/period/estimate controls; gate only exact-time conversion behind the existing confirmation.**

- [ ] **Step 5: Pass recurrence context for timed and untimed entries, expose instance/series scope, and implement per-instance complete/cancel/save flows.**

- [ ] **Step 6: Re-run focused tests and commit `feat: complete epic 03 planning workflows`.**

### Task 5: Cross-layer verification and visual quality

**Files:**
- Modify: affected test files only when a missing regression case is demonstrated.

- [ ] **Step 1: Run all tests, type checking, lint and the web export.**

Run: `npm test -- --runInBand && npm run typecheck && npm run lint && npm run web:export`

- [ ] **Step 2: Start the web app and manually verify: create date-only estimate, create timed task, edit it, plan reminder without time, and move/complete one recurring instance.**

- [ ] **Step 3: Run the Impeccable detector for all changed UI files and correct concrete accessibility or interaction findings.**

Run: `node C:\Users\Юлия\.codex\skills\impeccable\scripts\detect.mjs --json src/ui/backlog/task-planning-fields.tsx src/ui/backlog/item-form-sheet.tsx src/ui/plan/plan-screen.tsx`

- [ ] **Step 4: Run the complete verification set again, commit `test: verify epic 03 completion`, and push the current branch.**

## Plan self-review

- **Coverage:** Task 1 covers model/data/DST persistence; Task 2 covers date validation, occurrence semantics, load, conflicts and midnight; Task 3 covers calendar/time/duration UI; Task 4 covers the reported real workflows; Task 5 provides automated and visual checks.
- **Consistency:** the recurrence status and patches are created in Task 1, consumed in Task 2, and surfaced in Task 4. Exact blocks and estimates follow one contribution rule in Task 2.
- **No placeholders:** each task names exact files, behavior, test command and commit boundary.
