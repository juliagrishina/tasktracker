# Plan and Settings Refinement Implementation Plan

> **For implementation:** execute the tasks below in order, write the named test first for each behaviour change, and keep the work on `codex/epic-11-auth`.

**Goal:** Make Plan Day accurately communicate date and capacity, schedule a newly created Plan Day task by default, remove obsolete hints, and make account and settings editing unambiguous and truthful for authenticated offline-first use.

**Architecture:** The local domain model and sync contract do not change. Presentation derives capacity tone from the existing `PlanLoadTone`; planning uses the existing editable `TaskPlanningDraft` block list; settings continue to save one `UpdatePlanningSettingsInput` while rendering only the editor that belongs to the tapped setting.

**Spec:** `docs/superpowers/specs/2026-09-13-plan-and-settings-refinement-design.md`

**Out of scope:** Database migrations, auth-flow policy, sync protocol changes, and the historic `.docx` requirements file.

## Task 1 — Make Plan Day date and capacity presentation consistent

**Files:**
- Modify: `src/ui/plan/plan-period-model.ts`
- Create: `src/ui/plan/plan-load-appearance.ts`
- Modify: `src/ui/plan/progress-ring.tsx`
- Modify: `src/ui/plan/day-dashboard.tsx`
- Modify: `src/ui/plan/week-load-list.tsx`
- Modify: `src/ui/plan/month-load-grid.tsx`
- Modify: `__tests__/ui/plan-period-model.test.ts`
- Modify: `__tests__/ui/plan-dashboard.test.tsx`
- Modify: `__tests__/ui/plan-period-views.test.tsx`

1. Add a narrow day-header date formatter returning `ДД.ММ.ГГГГ`, retaining the existing natural-language formatter for week/month labels.
2. Add one `getPlanLoadAppearance(tone)` mapper with foreground, surface, and border colours for `low`, `medium`, and `high` using the established calendar/feedback tokens.
3. Pass the calculated tone to `ProgressRing` and use the same foreground colour for its active arc and Day Dashboard progress fill. Keep the track neutral and preserve accessibility values.
4. Render the day-header subtitle and navigator label with the compact formatter.
5. Apply the shared appearance to both Week and Month cards; in Week, set the row background and border by its load tone while preserving selected/today focus borders.
6. Add red tests for date output, high-load ring/bar tone, and Week’s toned card surface before implementing. Keep existing accessible labels and percentages.
7. Run: `npm test -- --runInBand __tests__/ui/plan-period-model.test.ts __tests__/ui/plan-dashboard.test.tsx __tests__/ui/plan-period-views.test.tsx`.

## Task 2 — Default a new Plan Day task to an editable nearest time block

**Files:**
- Modify: `src/ui/plan/plan-screen.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/backlog/task-planning-fields.tsx`
- Modify: `__tests__/ui/plan-task-create.test.tsx`
- Modify: `__tests__/ui/backlog-form.test.tsx`
- Modify: `__tests__/ui/task-planning-fields.test.tsx`

1. Extend the plan-creation context with an optional default time block only when creation starts from Plan Day; leave Backlog creation and editing unchanged.
2. Initialise that Plan Day draft with one existing `createDefaultBlock` value, based on the selected day and app timezone, and retain the existing no-free-slot callback/fallback semantics.
3. Reorder `TaskPlanningFields` so the time-block section immediately follows the task date and precedes repeat settings. The existing delete and add-block controls remain available.
4. Add red UI tests showing: Plan Day create opens with `Блок 1`; its date is the selected day; the first block renders before `Повторение`; and removing it leaves the draft valid as a date-only task.
5. Run: `npm test -- --runInBand __tests__/ui/plan-task-create.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/task-planning-fields.test.tsx`.

## Task 3 — Remove obsolete static hints

**Files:**
- Modify: `src/ui/backlog/backlog-root-screen.tsx`
- Modify: `src/ui/completed/completed-history-screen.tsx`
- Modify: `__tests__/ui/backlog-root-screen.test.tsx` (or the existing closest Backlog test)
- Modify: `__tests__/ui/completed-history-screen.test.tsx` (or the existing closest Completed test)

1. Remove only the static `Демо-планирование…` card from Backlog.
2. Remove only the static `Удалить окончательно…` notice from Completed; retain the confirmation interaction when the user actually deletes an item.
3. Add tests asserting the obsolete copy is absent and the underlying list/action controls stay present.
4. Run the two closest affected test files.

## Task 4 — Make account edits progressive, labelled, and cancellable

**Files:**
- Modify: `src/ui/settings/account-settings-card.tsx`
- Modify: `__tests__/ui/account-settings-card.test.tsx`

1. Keep profile-name editing independent from credential changes.
2. In the email-change panel, render labelled fields in this exact order: `Текущий пароль` (with visibility toggle), `Новый email` (plain email input), send-code action, then the pending email confirmation code. Do not attach an eye icon to email.
3. In the password panel, expose only the sequence required for the current stage: current password, request code, code, new password, confirmation; password fields retain visibility toggles.
4. Add explicit `Отмена` controls to close each editor and reset only its local draft/feedback, without signing out or modifying server data.
5. Write red tests for field labels, lack of a password visibility control on email, staged password fields, and cancellation; preserve existing callback contract tests.
6. Run: `npm test -- --runInBand __tests__/ui/account-settings-card.test.tsx`.

## Task 5 — Make settings rows consistent and sync copy accurate

**Files:**
- Modify: `src/ui/settings/settings-state-panel.tsx`
- Modify: `__tests__/ui/settings-state-panel.test.tsx`
- Modify: `docs/tz/epic-06-completed-energy-and-settings.md` only if implementation reveals wording needing an exact final-copy correction.

1. Make `Рабочий диапазон` and `Вечерняя проверка` rows open the Plan editor directly; remove the redundant card-level `Изменить` action.
2. Make the Plan editor render only working-range and evening-review controls. Make the Notifications editor render only notification lead controls. Both save the complete unchanged-plus-edited settings input through the current callback.
3. Replace device-only and anonymous-account copy in `Данные аккаунта и устройства` with an accurate account/offline message: account data is stored locally for offline work and synchronises on reconnection; local deletion or browser-data clearing requires a subsequent sync/download and is not presented as an anonymous backup.
4. Add red tests for row entry points, editor isolation, retained complete save payload, and absence of stale device-only/anonymous wording.
5. Run: `npm test -- --runInBand __tests__/ui/settings-state-panel.test.tsx`.

## Task 6 — Validate, review, document, and publish the code branch

**Files:** all files changed above; `docs/superpowers/specs/2026-09-13-plan-and-settings-refinement-design.md`; this plan.

1. Run the full targeted UI suite, then `npm test -- --runInBand` and the project type/lint checks defined by `package.json`.
2. Run `git diff --check` and the Impeccable detector against every modified UI file. Address detector findings unless demonstrably inapplicable.
3. Review the final diff against the approved design: no new anonymous entry point, no sync policy change, no hidden server mutation.
4. Commit cohesive implementation changes and push `codex/epic-11-auth`.
5. Before any staging deployment, request the user’s explicit immediate confirmation; deployment is not part of this plan’s automatic completion.
