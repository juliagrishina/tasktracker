# Production Regression Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Repair the reported production regressions in energy, planning, overdue-task review, account confirmation codes and the day timeline, then prepare one verified production release.

**Architecture:** Keep persisted business data and cloud-sync contracts unchanged. Fix UI state boundaries: a dedicated success route survives Backlog filtering, the energy picker derives its position from stored state, and overdue-task review opens the existing editor rather than mutating time automatically. Add regression coverage at domain, component and route boundaries.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, React Native Testing Library, Supabase Auth/Edge Functions, static Expo web export.

**Spec:** docs/superpowers/specs/2026-09-22-production-regression-hardening-design.md

## Global Constraints

- Production only; do not create or deploy a staging release.
- Do not change Nginx, DNS, SSL, SMTP credentials, Supabase secrets or production data.
- Do not add Outlook writes or request permissions above Calendars.Read.
- Account actions retain password plus six-digit OTP confirmation.
- Preserve local-first writes and existing account-sync outbox.
- Make one focused commit per task, run its tests, and push main.

## Review Focus

- A saved 0% energy value is valid, not a missing value; Task 1 tests it.
- A 24-hour block remains editable rather than showing «Выбрать»; Task 2 tests it.
- «Продлить» must not show a second prompt over the task editor; Task 3 tests it.
- A historical recurring occurrence follows the same final-block rule as a normal task; Task 3 tests it.
- Supabase HTTP 429 is shown as a cooldown, while other provider failures remain safe; Task 4 tests both.

---

## File structure

- src/ui/plan/daily-energy-check-in.tsx: controlled energy picker and post-layout centring.
- src/ui/plan/day-timeline.tsx: minute-aligned display clock without plan-data refresh.
- src/ui/backlog/duration-options.ts: shared five-minute duration options through 24 hours.
- src/ui/backlog/task-planning-fields.tsx: time blocks and a notice slot before repeat settings.
- src/ui/backlog/item-form-sheet.tsx: no-free-slot notice and shared estimated duration options.
- src/app/(tabs)/backlog/planned.tsx: dedicated immutable planning-success route.
- src/app/(tabs)/backlog/item/[id].tsx: navigates to the success route after saving.
- src/application/completion-eligibility.ts: canonical overdue task/occurrence lookup.
- src/ui/plan/day-dashboard.tsx and src/ui/plan/unfinished-task-dialog.tsx: editor-based «Продлить».
- src/application/password-management.ts, src/data/supabase-password-management.ts, src/ui/settings/settings-state-panel.tsx: safe OTP send feedback.

### Task 1: Restore saved energy selection and live timeline clock

**Files:**
- Modify: src/ui/plan/daily-energy-check-in.tsx
- Modify: src/ui/plan/day-timeline.tsx
- Test: __tests__/ui/daily-energy-check-in.test.tsx
- Test: __tests__/ui/day-timeline.test.tsx

**Interfaces:**
- Consumes: initialEnergyPercent: number | null | undefined, selectedDate and timeZoneId.
- Produces: selected picker value and its scroll position agree; current-time label updates every minute.

- [ ] **Step 1: Write failing tests for saved 75% and valid 0%**

~~~ts
expect(view.getByRole('radio', { name: 'Энергия 75%' })).toHaveAccessibilityState({ selected: true });
expect(mockScrollTo).toHaveBeenCalledWith({ animated: false, y: 15 * pickerRowHeight });
// rerender with initialEnergyPercent={0}; assert «Энергия 0%» is selected.
~~~

- [ ] **Step 2: Run the picker test to verify it fails**

Run: npm test -- --runInBand __tests__/ui/daily-energy-check-in.test.tsx

Expected: FAIL because the current initial-layout sequence does not reliably centre the saved row.

- [ ] **Step 3: Implement deterministic post-layout centring**

~~~ts
const selectedValue = initialEnergyPercent ?? defaultEnergyPercent;
const selectedIndex = energyValues.indexOf(selectedValue);
const scrollToSelectedEnergy = () =>
  pickerRef.current?.scrollTo({ animated: false, y: Math.max(0, selectedIndex) * pickerRowHeight });
~~~

Use one layout-ready callback and the modal-open effect to call scrollToSelectedEnergy. Add one-row vertical content padding so first and last values can be centred. Update selected React state only from an explicit press or settled scroll.

- [ ] **Step 4: Write a failing minute-update test**

~~~ts
jest.useFakeTimers().setSystemTime(new Date('2026-09-22T18:59:30+03:00'));
const view = render(<DayTimeline selectedDate="2026-09-22" timeZoneId="Europe/Moscow" {...props} />);
act(() => jest.advanceTimersByTime(30_000));
expect(view.getByLabelText('Текущее время 19:00')).toBeOnTheScreen();
~~~

- [ ] **Step 5: Add a minute-aligned display clock**

~~~ts
const [displayNow, setDisplayNow] = useState(() => now ?? new Date());
useEffect(() => {
  if (now !== undefined) { setDisplayNow(now); return; }
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    setDisplayNow(new Date());
    interval = setInterval(() => setDisplayNow(new Date()), 60_000);
  }, 60_000 - Date.now() % 60_000);
  return () => { clearTimeout(timeout); if (interval !== undefined) clearInterval(interval); };
}, [now]);
~~~

Use displayNow for the line and label. Keep initial scrolling keyed to initial display time only, so ticking never repositions the reader.

- [ ] **Step 6: Verify and commit**

Run: npm test -- --runInBand __tests__/ui/daily-energy-check-in.test.tsx __tests__/ui/day-timeline.test.tsx

Expected: PASS.

~~~bash
git add src/ui/plan/daily-energy-check-in.tsx src/ui/plan/day-timeline.tsx __tests__/ui/daily-energy-check-in.test.tsx __tests__/ui/day-timeline.test.tsx
git commit -m "fix: restore energy picker and live timeline"
~~~

### Task 2: Support 24-hour blocks and durable planning success

**Files:**
- Create: src/ui/backlog/duration-options.ts
- Create: src/app/(tabs)/backlog/planned.tsx
- Modify: src/ui/backlog/task-planning-fields.tsx
- Modify: src/ui/backlog/item-form-sheet.tsx
- Modify: src/app/(tabs)/backlog/item/[id].tsx
- Test: __tests__/ui/task-planning-fields.test.tsx
- Test: __tests__/ui/backlog-form.test.tsx
- Create Test: __tests__/ui/backlog-route-planning.test.tsx

**Interfaces:**
- Produces: blockDurationOptions and estimatedDurationOptions with five-minute values through 1440.
- Consumes: ItemFormSheet.onPlanned(result: PlanningSuccessResult).
- Produces: /backlog/planned route rendering PlanningSuccess without resolving an active Backlog item.

- [ ] **Step 1: Write failing duration and notice-order tests**

~~~ts
expect(blockDurationOptions.at(-1)).toEqual({ label: '24 ч', value: '1440' });
expect(view.getByLabelText('Длительность блока 1')).toHaveTextContent('24 ч');
expect(treeText.indexOf('нет свободного окна')).toBeLessThan(treeText.indexOf('Повторение'));
~~~

- [ ] **Step 2: Run the current planning-form tests**

Run: npm test -- --runInBand __tests__/ui/task-planning-fields.test.tsx __tests__/ui/backlog-form.test.tsx

Expected: FAIL because both current duration lists end at 480 and the notice follows repeat settings.

- [ ] **Step 3: Implement shared duration options and the notice slot**

~~~ts
export const blockDurationOptions = Array.from({ length: 288 }, (_, index) => {
  const minutes = (index + 1) * 5;
  return { label: formatDuration(minutes), value: String(minutes) };
});
export const estimatedDurationOptions = [{ label: 'Без оценки', value: '' }, ...blockDurationOptions];
~~~

Replace both local arrays with these exports. Add timeBlockNotice?: ReactNode to TaskPlanningFieldsProps; render that node after the mapped blocks and before repeat controls. Pass the existing no-free-slot JSX from ItemFormSheet to that prop without changing its alternative-date or conflict actions.

- [ ] **Step 4: Write a failing route regression test for «Личное»**

~~~ts
fireEvent(plannedCallback, { plannedOn: '2026-09-22', title: 'Личное дело', type: 'task' });
expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/backlog/planned' }));
expect(view.queryByText('Элемент больше не находится в активном Backlog.')).toBeNull();
~~~

- [ ] **Step 5: Implement the dedicated success route**

~~~ts
router.replace({
  pathname: '/backlog/planned',
  params: { plannedOn: result.plannedOn, title: result.title, type: result.type },
});
~~~

Validate the three string route params in planned.tsx and render PlanningSuccess. Its plan action replaces the route with / and the planned date. Remove the transient planningResult state from the item route; filtering/remounting can no longer discard success.

- [ ] **Step 6: Verify and commit**

Run: npm test -- --runInBand __tests__/ui/task-planning-fields.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-route-planning.test.tsx

Expected: PASS.

~~~bash
git add src/ui/backlog/duration-options.ts src/ui/backlog/task-planning-fields.tsx src/ui/backlog/item-form-sheet.tsx "src/app/(tabs)/backlog/planned.tsx" "src/app/(tabs)/backlog/item/[id].tsx" __tests__/ui/task-planning-fields.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-route-planning.test.tsx
git commit -m "fix: preserve planning success and 24-hour blocks"
~~~

### Task 3: Make overdue review open the editor instead of auto-extending

**Files:**
- Modify: src/application/completion-eligibility.ts
- Modify: src/application/app-services-provider.tsx
- Modify: src/application/planning-use-cases.ts
- Modify: src/ui/plan/day-dashboard.tsx
- Modify: src/ui/plan/unfinished-task-dialog.tsx
- Test: __tests__/application/completion-eligibility.test.ts
- Test: __tests__/application/planning-use-cases.test.ts
- Test: __tests__/ui/plan-dashboard.test.tsx
- Test: __tests__/ui/completion-dialog.test.tsx

**Interfaces:**
- Consumes: CompletionEligibility and existing onEditTask/onEditRecurrence callbacks.
- Produces: one editor transition for «Продлить», with no hidden schedule write and no prompt over the editor.

- [ ] **Step 1: Write failing historical-recurrence and future-end tests**

~~~ts
await expect(getCompletionEligibility(source, new Date('2026-09-22T19:00:00+03:00')))
  .resolves.toContainEqual({
    taskItemId: 'series-task',
    occurrence: { seriesId: 'series-1', occursOn: '2026-09-21' },
  });
// A saved occurrence final end at 20:00 is absent at 19:00.
~~~

- [ ] **Step 2: Run the domain tests to demonstrate current inconsistency**

Run: npm test -- --runInBand __tests__/application/completion-eligibility.test.ts __tests__/application/planning-use-cases.test.ts

Expected: FAIL because recurrence checks only the current date and automatic continuation writes an old block.

- [ ] **Step 3: Implement one effective-final-block eligibility rule**

~~~ts
type Candidate = CompletionEligibility & { endsAt: string };
// Group active ordinary tasks and active recurrence occurrences,
// retain each group’s final effective block, and keep endsAt <= now.
~~~

Enumerate effective recurrence occurrences through the plan date containing now, ignore cancelled/completed occurrences, and sort candidates by endsAt. Do not write data while evaluating eligibility.

- [ ] **Step 4: Write a failing «Продлить» transition test**

~~~ts
fireEvent.press(view.getByRole('button', { name: 'Продлить' }));
expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
expect(mockContinueIncompleteTask).not.toHaveBeenCalled();
expect(view.queryByText('Удалось закончить?')).toBeNull();
~~~

- [ ] **Step 5: Implement editor-only extension**

~~~ts
const openExtensionEditor = () => {
  if (completionCandidate === null) return;
  const { eligibility, task } = completionCandidate;
  setCompletionCandidate(null);
  setIsUnfinishedDialogVisible(false);
  if (eligibility.occurrence === null) onEditTask?.(task);
  else onEditRecurrence?.(task, eligibility.occurrence.seriesId, eligibility.occurrence.occursOn);
};
~~~

Rename the dialog button/accessibility label to «Продлить» and bind it to openExtensionEditor. Remove continueIncompleteTask from exposed planning actions and its automatic 30-minute use case/test. Keep explicit “Перенести” and “Вернуть в Backlog” unchanged.

- [ ] **Step 6: Verify and commit**

Run: npm test -- --runInBand __tests__/application/completion-eligibility.test.ts __tests__/application/planning-use-cases.test.ts __tests__/ui/plan-dashboard.test.tsx __tests__/ui/completion-dialog.test.tsx

Expected: PASS.

~~~bash
git add src/application/completion-eligibility.ts src/application/app-services-provider.tsx src/application/planning-use-cases.ts src/ui/plan/day-dashboard.tsx src/ui/plan/unfinished-task-dialog.tsx __tests__/application/completion-eligibility.test.ts __tests__/application/planning-use-cases.test.ts __tests__/ui/plan-dashboard.test.tsx __tests__/ui/completion-dialog.test.tsx
git commit -m "fix: open overdue tasks for manual extension"
~~~

### Task 4: Give account-data code requests accurate feedback

**Files:**
- Modify: src/application/password-management.ts
- Modify: src/data/supabase-password-management.ts
- Modify: src/ui/settings/settings-state-panel.tsx
- Test: __tests__/application/password-management.test.ts
- Test: __tests__/data/supabase-password-management.test.ts
- Test: __tests__/ui/settings-state-panel.test.tsx
- Test: __tests__/supabase/auth-protection-contract.test.ts

**Interfaces:**
- Produces: codeSent, resendCooldown, or safe requestFailed results.
- Consumes: signInWithOtp({ email, options: { shouldCreateUser: false } }) and Edge verifyOtp({ type: 'email' }).

- [ ] **Step 1: Write failing send, 429 and provider-failure tests**

~~~ts
gateway.sendChangeCode.mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 }));
await expect(service.requestPasswordChangeCode()).resolves.toMatchObject({ kind: 'resendCooldown' });
expect(view.getByText('Новый код можно запросить через минуту.')).toBeOnTheScreen();
~~~

Also assert a non-429 failure displays only the safe requestFailed.message, not raw provider text, and the static contract retains magic-link template plus OTP type email.

- [ ] **Step 2: Run focused tests to verify current generic behaviour fails**

Run: npm test -- --runInBand __tests__/application/password-management.test.ts __tests__/data/supabase-password-management.test.ts __tests__/ui/settings-state-panel.test.tsx __tests__/supabase/auth-protection-contract.test.ts

Expected: FAIL because the panel maps every non-success to one generic label and the gateway does not classify HTTP 429.

- [ ] **Step 3: Implement safe classification and feedback**

~~~ts
if (status === 429) throw new PasswordManagementGatewayError('rateLimited');
if (error instanceof PasswordManagementGatewayError && error.kind === 'rateLimited') {
  return { kind: 'resendCooldown', availableAtMs: currentTime + RESEND_COOLDOWN_MS };
}
~~~

Extend PasswordManagementGatewayError with rateLimited. In requestAccountDataCode, map codeSent, resendCooldown and requestFailed separately. Never display Supabase response bodies, SMTP details, tokens or email addresses.

- [ ] **Step 4: Verify and commit**

Run: npm test -- --runInBand __tests__/application/password-management.test.ts __tests__/data/supabase-password-management.test.ts __tests__/ui/settings-state-panel.test.tsx __tests__/supabase/auth-protection-contract.test.ts

Expected: PASS.

~~~bash
git add src/application/password-management.ts src/data/supabase-password-management.ts src/ui/settings/settings-state-panel.tsx __tests__/application/password-management.test.ts __tests__/data/supabase-password-management.test.ts __tests__/ui/settings-state-panel.test.tsx __tests__/supabase/auth-protection-contract.test.ts
git commit -m "fix: clarify account data confirmation codes"
~~~

### Task 5: Verify the full production export and prepare deployment

**Files:**
- Verify: package.json, scripts/verify-production-config.cjs, generated dist/ (do not commit generated output).

**Interfaces:**
- Consumes: all commits from Tasks 1–4.
- Produces: a production web export ready for the existing VPS copy operation.

- [ ] **Step 1: Run static and full automated verification**

~~~bash
npm run typecheck
npm run lint
npm test -- --runInBand
~~~

Expected: all commands exit 0; no newly introduced lint warnings and Jest exits cleanly.

- [ ] **Step 2: Build and verify the production export**

~~~bash
npm run web:export
node scripts/verify-production-config.cjs --env-file .env.local --dist dist
~~~

Expected: Exported: dist and Production web configuration verified. The bundle references production Supabase only.

- [ ] **Step 3: Inspect and push intended changes**

~~~bash
git status --short --branch
git log --oneline origin/main..HEAD
git push origin main
~~~

Expected: only planned source/test changes exist and main is pushed.

- [ ] **Step 4: Request deployment authorization and provide exact VPS commands**

Do not deploy automatically. After explicit user authorization, run the established production sequence on the server checkout:

~~~bash
git pull
npm ci
npm run typecheck
npm test -- --runInBand
npm run web:export
sudo rm -rf /var/www/tasktracker/*
sudo cp -a dist/. /var/www/tasktracker/
curl -I https://planmyplan.ru
~~~

Expected: curl returns HTTP 200/3xx. Do not change Nginx, DNS, SSL, secrets or SMTP.

## Self-review

### Spec coverage

- Energy picker and current-time line: Task 1.
- Personal-project planning success, 24-hour blocks and notice position: Task 2.
- Manual extension and ordinary/recurring overdue checks: Task 3.
- Account-data code flow: Task 4.
- Production-only verified export and deployment handoff: Task 5.

### Placeholder scan

No unfinished placeholders or generic error-handling instructions remain. Each task names concrete files, tests and commands.

### Type consistency

PlanningSuccessResult, CompletionEligibility, PasswordManagementResult and existing editor callbacks keep their names across tasks. New shared duration exports are blockDurationOptions and estimatedDurationOptions throughout.

### Review-focus coverage

Each listed risk has an explicit test in its owning task.
