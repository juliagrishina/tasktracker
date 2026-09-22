# Production regression hardening design

**Date:** 2026-09-22
**Status:** approved for implementation
**Scope:** production behaviour of Plan My Plan only; no new product areas or staging release.

## Goal

Restore the planning, energy, completion-review and account-data flows that regressed in production. Every reported behaviour receives a regression test before the production web export is deployed.

## Design decisions

### Energy check-in

The check-in picker is controlled by the stored entry for the current plan date. On opening, it must render and centre that value (for example, 75%), rather than visually defaulting to 0%. Selecting a value must update the displayed selection without resetting the picker. The saved entry continues to be written locally first and then included in ordinary account sync.

### Planning confirmation from Backlog

A task is intentionally removed from the *active* Backlog as soon as it is planned. The detail route must therefore retain the immutable planning-success result in its own state and render that result before attempting to resolve the task from the filtered Backlog view. The user sees the success card and can navigate to the planned date irrespective of project, including «Личное».

### Review of overdue tasks

The review query must use one canonical rule for ordinary tasks and recurring occurrences: an active planned item is eligible when its final effective block has ended. It must inspect the appropriate historical occurrence, not only the current-day recurring projection.

The unfinished-task choice is renamed from «Продлить на 30 минут» to «Продлить». Choosing it:

1. closes the completion prompt;
2. opens the normal editor for that task or occurrence;
3. makes no automatic change to its time or duration.

The editor exposes all valid durations through 24 hours. Once the user saves a new future end, the task is not eligible again until that end has passed. Closing the editor without saving leaves the task overdue and eligible for a later review, but never displays a competing prompt over the editor or loops immediately after the button press.

### Planning form

Both estimated task duration and each timed block accept five-minute increments up to 24 hours. Existing blocks above the former eight-hour UI limit therefore remain representable and editable.

The «нет свободного окна» notice is located immediately after the time-block controls and before repeat controls. Its choices and conflict confirmation behaviour do not change.

### Live day timeline

The day timeline owns a minute-aligned clock tick while it is mounted. It updates the current time line and its accessibility label on each minute without refreshing data or moving the user's scroll position. The timer is cleaned up when the screen unmounts.

### Account-data confirmation code

Clear-account-data and delete-account continue to require the authenticated user's password and a six-digit one-time email code. The code request uses the configured magic-link/OTP flow, which does not replace the active application session; the Edge function validates that same code before the irreversible operation.

The UI must distinguish a sent code, the configured resend cooldown/rate limit, and a genuine send failure instead of reducing all Supabase responses to «Не удалось отправить код». The production magic-link template remains the source of the six-digit code.

## Regression coverage

- stored 75% energy is selected and remains selected while edited;
- planning a task from an unassigned/personal project displays the success result;
- overdue ordinary and recurring tasks are found consistently;
- «Продлить» opens editing without mutating a block or reopening the prompt immediately;
- after editing a block to a future end, no prompt appears until that end;
- 8-hour-plus and 24-hour duration values display and round-trip;
- no-free-slot notice precedes repeat controls;
- advancing fake time advances the live current-time line without a new plan-data fetch;
- account-data code request maps success, cooldown and provider failure visibly, and the Edge contract verifies the same OTP type.

## Release and non-goals

No Nginx, DNS, SSL, SMTP credentials, Supabase secrets or data are changed as part of this code fix. After the tests and production configuration checks pass, export the current `main` and deploy the contents of `dist` to the existing production web root. There is no staging release.
