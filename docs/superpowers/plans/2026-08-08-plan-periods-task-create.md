# Plan periods and task creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Week A, Month B and unified task-creation sheet to the Plan tab, preserving Plan B and the current UI architecture.

**Architecture:** `PlanScreen` becomes the feature composition that owns selected date, view mode and the local task-sheet state. Pure period/load helpers and one shared demo data source feed `DayDashboard`, `WeekLoadList` and `MonthLoadGrid`; no schedule, recurrence or Outlook persistence is added. The existing `ItemFormSheet` remains the common task form and gets an opt-in `planningContext` used only when opened from Plan.

**Tech Stack:** React Native 0.81, Expo Router 6, TypeScript, React Native Testing Library, Jest, Expo web.

## Global Constraints

- Preserve Plan B / Backlog 2 / Completed 1 / Settings 2 visual compositions; do not perform unrelated refactoring.
- The mode menu contains exactly `День`, `Неделя`, `Месяц`; Week starts Monday.
- Week and Month show only date and exact load percentage, never task titles, blocks, Outlook events or sync controls.
- Exact load thresholds: `0–50` green, `51–70` yellow, `71+` red; values above 100 are never capped.
- A date tap from Week or Month opens Day for that date; visible period arrows remain available on web and iOS.
- Use existing tokens and primitives. Add only semantic red heatmap surface/border tokens required by approved Month B; do not hardcode color values in feature components.
- Plan FAB opens a direct new-task sheet, not a project/reminder selector. Only title is required.
- The new planning fields are UI/demo state until Epic 03 provides task date/period/recurrence use cases. Do not claim that a date, recurrence or time block has been persisted; existing core task creation may still use `backlogActions.createTask`.
- Keep touch targets ≥44 pt, iOS safe areas and keyboard behaviour; web uses the same narrow mobile composition and visible keyboard focus.
- Every task follows TDD, runs its focused tests, and creates one small commit. Full verification before the final handoff: `npm test`, `npm run typecheck`, `npm run lint`, `npm run web:export` and manual web inspection.

---

## File map

| File | Responsibility |
|---|---|
| `src/ui/design/tokens.ts` | Semantic danger surface/border for the approved heatmap. |
| `src/ui/plan/plan-period-model.ts` | Pure local-date, period, percentage and demo-load helpers. |
| `src/ui/plan/plan-view-menu.tsx` | Accessible three-option view menu. |
| `src/ui/plan/plan-period-navigator.tsx` | Previous/next period control used by Week and Month. |
| `src/ui/plan/week-load-list.tsx` | Week A: seven compact, pressable load rows. |
| `src/ui/plan/month-load-grid.tsx` | Month B: calendar grid of heatmap day cells. |
| `src/ui/plan/plan-screen.tsx` | Mode/date/FAB composition; renders the approved Plan feature view. |
| `src/ui/plan/day-dashboard.tsx` | Receives PlanScreen callbacks and selected date without changing its Plan B hierarchy. |
| `src/ui/backlog/task-planning-fields.tsx` | Controlled optional planning fields for the task sheet only. |
| `src/ui/backlog/item-form-sheet.tsx` | Opt-in Plan task context and core task save integration. |
| `src/app/(tabs)/index.tsx` | Thin route that renders `PlanScreen`. |
| `__tests__/ui/plan-period-model.test.ts` | Pure period/load threshold tests. |
| `__tests__/ui/plan-period-views.test.tsx` | Menu, navigation, Week A, Month B and date-to-Day tests. |
| `__tests__/ui/plan-task-create.test.tsx` | FAB and approved task-form states. |
| `__tests__/ui/design-tokens.test.ts` | Token contract for the new semantic heatmap values. |

## Task 1: Create the period/load model and semantic heatmap tokens

**Files:**
- Create: `src/ui/plan/plan-period-model.ts`
- Create: `__tests__/ui/plan-period-model.test.ts`
- Modify: `src/ui/design/tokens.ts`
- Modify: `__tests__/ui/design-tokens.test.ts`

**Interfaces:**
- Produces `PlanViewMode`, `PlanLoadTone`, `PlanLoadDay`, `getWeekLoadDays()`, `getMonthLoadDays()`, `shiftPlanAnchor()` and `getPlanLoadTone()`.
- Consumed by `PlanScreen`, `WeekLoadList` and `MonthLoadGrid` in later tasks.

- [ ] **Step 1: Write failing pure-model and token tests**

```ts
import {
  getPlanLoadTone,
  getWeekLoadDays,
  shiftPlanAnchor,
} from '../../src/ui/plan/plan-period-model';

test('maps all approved load thresholds without capping overload', () => {
  expect(getPlanLoadTone(0)).toBe('low');
  expect(getPlanLoadTone(50)).toBe('low');
  expect(getPlanLoadTone(51)).toBe('medium');
  expect(getPlanLoadTone(70)).toBe('medium');
  expect(getPlanLoadTone(71)).toBe('high');
  expect(getPlanLoadTone(104)).toBe('high');
});

test('builds a Monday-first seven-day week around its selected day', () => {
  expect(getWeekLoadDays('2026-08-05').map((day) => day.isoDate)).toEqual([
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
    '2026-08-07', '2026-08-08', '2026-08-09',
  ]);
  expect(shiftPlanAnchor('2026-08-05', 'week', 1)).toBe('2026-08-12');
});
```

Add a token assertion that `color.calendar.load.high.surface` and `.border` exist, while existing primary/success/warning values remain unchanged.

- [ ] **Step 2: Run the focused tests to confirm failure**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-period-model.test.ts __tests__/ui/design-tokens.test.ts`

Expected: FAIL because the period model and `color.calendar.load.high` values do not yet exist.

- [ ] **Step 3: Implement the smallest model and token extension**

```ts
export type PlanViewMode = 'day' | 'week' | 'month';
export type PlanLoadTone = 'low' | 'medium' | 'high';

export interface PlanLoadDay {
  isoDate: string;
  dayOfMonth: number;
  weekdayLabel: string;
  loadPercent: number;
  tone: PlanLoadTone;
}

export function getPlanLoadTone(loadPercent: number): PlanLoadTone {
  if (loadPercent <= 50) return 'low';
  if (loadPercent <= 70) return 'medium';
  return 'high';
}
```

Implement all date arithmetic through local calendar parts (`YYYY-MM-DD` / local `Date(year, month, day)`) rather than UTC string parsing. Keep the fixed demo percentage map in this file so Week and Month read the same source. Extend only `designTokens.color.calendar.load.high` with `surface` and `border`; map low and medium cells to existing semantic success/warning tokens.

- [ ] **Step 4: Run focused tests and type check**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-period-model.test.ts __tests__/ui/design-tokens.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the independently tested model**

```bash
git add src/ui/design/tokens.ts src/ui/plan/plan-period-model.ts __tests__/ui/plan-period-model.test.ts __tests__/ui/design-tokens.test.ts
git commit -m "feat: add plan period load model"
```

## Task 2: Add the shared Plan mode menu and period navigator

**Files:**
- Create: `src/ui/plan/plan-view-menu.tsx`
- Create: `src/ui/plan/plan-period-navigator.tsx`
- Create: `src/ui/plan/plan-screen.tsx`
- Modify: `src/ui/plan/day-dashboard.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Create: `__tests__/ui/plan-period-views.test.tsx`

**Interfaces:**
- `PlanScreen(): JSX.Element` owns `mode: PlanViewMode`, `selectedDate: string`, `taskSheetVisible: boolean`.
- `PlanViewMenu({ mode, onSelectMode }: { mode: PlanViewMode; onSelectMode(mode: PlanViewMode): void })`.
- `PlanPeriodNavigator({ label, onPrevious, onNext }: { label: string; onPrevious(): void; onNext(): void })`.
- `DayDashboard` accepts `selectedDate`, `onSelectMode`, `onCreateTask` and keeps its existing Plan B sections unchanged.

- [ ] **Step 1: Write the failing mode-switch test**

```tsx
const view = await render(<PlanScreen />);

fireEvent.press(view.getByLabelText('Режим просмотра: День'));
fireEvent.press(view.getByRole('button', { name: 'Неделя' }));

expect(view.getByLabelText('Режим просмотра: Неделя')).toBeOnTheScreen();
```

Add assertions that the menu presents exactly three labels and that pressing its `Месяц` option changes the mode-control label to `Режим просмотра: Месяц`. The Week and Month content assertions belong to Task 3.

- [ ] **Step 2: Run the focused test to confirm failure**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-period-views.test.tsx`

Expected: FAIL because `PlanScreen` and the menu are absent.

- [ ] **Step 3: Implement composition and preserve Plan B**

Implement `PlanViewMenu` as an accessible local Modal/menu with three 44 pt Pressables and a checkmark/selected treatment for the active mode. Build `PlanPeriodNavigator` with `Предыдущая неделя|месяц` and `Следующая неделя|месяц` accessibility labels. Move root state out of `DayDashboard` into `PlanScreen`; the former remains responsible only for the already approved Day B visual hierarchy and receives callbacks.

Replace the route body with:

```tsx
export default function PlanRoute() {
  const { isReady } = useAppServices();
  return isReady ? <PlanScreen /> : <Text style={styles.loading}>Загружаем план…</Text>;
}
```

- [ ] **Step 4: Run focused tests and inspect Day regression**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-dashboard.test.tsx __tests__/ui/plan-period-views.test.tsx`

Expected: PASS, including existing Plan B labels `Сегодня`, `План в норме`, `Без времени`, `Расписание` and `Планёрка команды` for the default day.

- [ ] **Step 5: Commit mode ownership**

```bash
git add src/ui/plan/plan-view-menu.tsx src/ui/plan/plan-period-navigator.tsx src/ui/plan/plan-screen.tsx src/ui/plan/day-dashboard.tsx src/app/(tabs)/index.tsx __tests__/ui/plan-period-views.test.tsx
git commit -m "feat: add plan view navigation"
```

## Task 3: Implement Week A and Month B feature views

**Files:**
- Create: `src/ui/plan/week-load-list.tsx`
- Create: `src/ui/plan/month-load-grid.tsx`
- Modify: `src/ui/plan/plan-screen.tsx`
- Modify: `__tests__/ui/plan-period-views.test.tsx`

**Interfaces:**
- `WeekLoadList({ days, selectedDate, onSelectDate })` receives exactly seven `PlanLoadDay` entries.
- `MonthLoadGrid({ weeks, selectedDate, onSelectDate })` receives five or six Monday-first rows; blank cells are represented by `null`.
- Both surface `onSelectDate(isoDate: string)` to `PlanScreen`, which sets Day mode with that date.

- [ ] **Step 1: Add failing tests for approved compact views**

```tsx
fireEvent.press(view.getByRole('button', { name: 'Неделя' }));
expect(view.getAllByLabelText(/загрузка/)).toHaveLength(7);
expect(view.queryByText('Собрать прототип')).toBeNull();

fireEvent.press(view.getByLabelText('Среда, 5 августа: загрузка 104%'));
expect(view.getByLabelText('Режим просмотра: День')).toBeOnTheScreen();

fireEvent.press(view.getByRole('button', { name: 'Месяц' }));
expect(view.getByLabelText('5 августа: загрузка 104%')).toBeOnTheScreen();
```

Add an arrow test that changes Week from `3–9 августа` to `10–16 августа`, and a month arrow test that changes August to September.

- [ ] **Step 2: Run the focused test to confirm failure**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-period-views.test.tsx`

Expected: FAIL because Week A / Month B views are not rendered.

- [ ] **Step 3: Implement the approved views without generic over-abstraction**

`WeekLoadList` renders seven `SurfaceCard` rows with full weekday/date, short progress bar and exact percentage. `MonthLoadGrid` renders its Pn–Vs headings and pressable cells with no task content. For a high load cell use `designTokens.color.calendar.load.high.surface` and `.border`; do not use an inline hex or derive an ad-hoc rgba. Keep width/spacing/radius tokens and `temporaryWebContentStyle` consistent with Plan B.

In `PlanScreen`, render the list or grid by `mode`; date press sets `selectedDate` and `mode` to `'day'`.

- [ ] **Step 4: Run focused tests, typecheck and accessibility lint**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-period-views.test.tsx && npm run typecheck && npm run lint`

Expected: PASS. The test verifies seven week labels, an overloaded `104%` day, no task titles in Week/Month, both arrows and date-to-Day transition.

- [ ] **Step 5: Commit the two approved period views**

```bash
git add src/ui/plan/week-load-list.tsx src/ui/plan/month-load-grid.tsx src/ui/plan/plan-screen.tsx __tests__/ui/plan-period-views.test.tsx
git commit -m "feat: add week and month plan views"
```

## Task 4: Add the approved unified Plan task sheet as UI/demo state

**Files:**
- Create: `src/ui/backlog/task-planning-fields.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/plan/plan-screen.tsx`
- Create: `__tests__/ui/plan-task-create.test.tsx`

**Interfaces:**
- `TaskScheduleMode = 'none' | 'date' | 'period'` and `TaskPlanningDraft` live in `task-planning-fields.tsx`.
- `TaskPlanningFields({ value, onChange, defaultBlock }: TaskPlanningFieldsProps)` is controlled and uses no repository or network access.
- `ItemFormSheet` gets optional `planningContext?: { defaultDate: string; onPlanningDraftChange?(draft: TaskPlanningDraft): void }`; it renders planning fields only when `type === 'task'` and this context is present.
- `PlanScreen` passes that context from any mode FAB. Backlog keeps its existing creation menu and does not receive the Plan-only fields.

- [ ] **Step 1: Write failing task-sheet tests**

```tsx
fireEvent.press(view.getByLabelText('Добавить в план'));
expect(view.getByText('Новая задача')).toBeOnTheScreen();
expect(view.getByText('Без даты')).toBeOnTheScreen();

fireEvent.press(view.getByText('Период'));
expect(view.getByLabelText('Начало периода задачи')).toBeOnTheScreen();
expect(view.getByLabelText('Конец периода задачи')).toBeOnTheScreen();

fireEvent.press(view.getByText('Добавить блок времени'));
expect(view.getByLabelText('Начало блока 1')).toBeOnTheScreen();
expect(view.getByLabelText('Длительность блока 1')).toBeOnTheScreen();
```

Add a test saving `Название` only through the Plan sheet and assert that the existing `createTask` call receives title/project/description/duration but receives no invented schedule persistence request.

- [ ] **Step 2: Run the focused test to confirm failure**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-task-create.test.tsx`

Expected: FAIL because Plan FAB still only shows feedback and planning fields do not exist.

- [ ] **Step 3: Implement only approved, non-persistent planning UI**

Create the unified scrollable form structure: required title, optional description, project, estimated duration, planning mode chips, date or period controls, repetition selector/interval and a list of blocks with add/remove actions. Keep its state inside the sheet. `createDefaultBlock(defaultDate, now)` rounds start up to five minutes and sets duration to 60 minutes.

When title-only data is saved, retain the existing `backlogActions.createTask` path. When planning fields are filled, keep the draft local and do not write schedule blocks, recurrence series, task date/period fields or conflict decisions; those belong to Epic 03. Do not display success copy implying that these local fields were saved. The Plan FAB opens this opt-in context directly, while Backlog form behaviour stays unchanged.

- [ ] **Step 4: Run focused form and regression tests**

Run: `npm test -- --runTestsByPath __tests__/ui/plan-task-create.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-root.test.tsx && npm run typecheck`

Expected: PASS. Existing blank-title validation and Backlog type selector stay intact; Plan form exposes all approved optional field states.

- [ ] **Step 5: Commit the Plan task sheet**

```bash
git add src/ui/backlog/task-planning-fields.tsx src/ui/backlog/item-form-sheet.tsx src/ui/plan/plan-screen.tsx __tests__/ui/plan-task-create.test.tsx
git commit -m "feat: add plan task creation sheet"
```

## Task 5: Verify the complete web and iOS-ready UI slice

**Files:**
- Modify only if verification discovers a defect in one of the files above.
- Test: all existing and new tests under `__tests__/`.

**Interfaces:**
- Consumes the completed Plan screen, UI components and form contracts from Tasks 1–4.
- Produces a verified browser prototype; no backend, Outlook or data-model extension.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test && npm run typecheck && npm run lint && npm run web:export`

Expected: all commands exit `0`.

- [ ] **Step 2: Manually inspect narrow and wide web**

Run: `npm run web`

At a 390 px viewport, verify Day B is unchanged; open `Неделя` and check seven rows/colours/104%; open `Месяц` and check heatmap cells contain only date/percentage; use arrows; tap a date back to Day; open the FAB task sheet and exercise none/date/period/repetition/block UI. At a wide viewport, verify only the existing centered temporary mobile composition appears—no invented desktop layout.

- [ ] **Step 3: Run the design-system self-review**

Run: `rg -n "#[0-9A-Fa-f]{3,8}|rgba\\(" src/ui/plan src/ui/backlog/task-planning-fields.tsx`

Expected: no new component-local visual values; any approved visual value comes from `designTokens`.

Review duplicated layout: all common mode controls must stay in `PlanViewMenu`/`PlanPeriodNavigator`, while Week and Month retain only their feature-specific composition.

- [ ] **Step 4: Commit final verification fixes only if needed**

```bash
git status --short
git add src/ui/design/tokens.ts src/ui/plan src/ui/backlog/item-form-sheet.tsx src/ui/backlog/task-planning-fields.tsx __tests__/ui
git diff --cached --quiet || git commit -m "fix: verify plan period UI"
```

Do not create an empty commit. Before push, re-run `git status --short --branch` and confirm it contains no untracked application files.
