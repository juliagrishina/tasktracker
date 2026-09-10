# Product Access and Offline Policy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical requirements, Epic 11 plan, and QA checklist state one consistent product policy: no user-facing guest entry, while a previously authenticated account remains fully usable offline.

**Architecture:** `docs/tz/account-authentication-and-cloud-sync.md` becomes the normative policy source. Historical Epic 01 and architecture documents retain their historical implementation context, but receive an explicit E11 override rather than silently conflicting requirements. E11-T28 describes persistent account data; E11-T29 adds the offline PWA shell; E11-T31 verifies the full user contract.

**Tech Stack:** Markdown requirements, Jest QA suite, Expo web export, iPhone PWA manual acceptance.

**Spec:** `docs/tz/account-authentication-and-cloud-sync.md`; `docs/superpowers/plans/2026-09-01-epic-11-account-auth-and-cloud-sync.md`

## Global constraints

- The guest-entry removal is a temporary **product** policy, not a QA-only switch. It remains in force after E11 QA until a separately approved product decision changes it.
- Saved autonomous/anonymous areas remain protected data and a migration source; they are not a user-accessible mode and must not be deleted or silently imported.
- Network is required for registration, the first credentialed sign-in on a device, explicit re-authentication, and a session that cannot be refreshed from its stored credentials. The policy must not claim that registration is the only network-dependent action.
- After one successful online sign-in on a device, a valid persisted session opens the installed PWA and native app offline; all business CRUD stays local, and sync commands remain durable in outbox until reconnect.
- T29 alone provides offline app shell. T28 alone does not guarantee opening a fully closed browser/PWA without network.
- Do not change production Supabase, app code, local data, or current staging configuration in this documentation-alignment work.

## Files to change

| Path | Responsibility |
| --- | --- |
| `docs/tz/account-authentication-and-cloud-sync.md` | Normative access policy, network boundary, state model, legacy-area treatment and acceptance contract. |
| `docs/tz/account-data-and-cloud-architecture.md` | Mark pre-E11 anonymous-first text as superseded for access policy while retaining it as historical architecture. |
| `docs/tz/epic-00-overview.md` | Replace the MVP-wide promise of no registration/login with a link to the E11 account/offline policy. |
| `docs/tz/epic-01-app-shell-and-local-storage.md` | Preserve local/offline foundations, but mark its pre-E11 no-auth first-run criteria as superseded. |
| `docs/superpowers/plans/2026-09-01-epic-11-account-auth-and-cloud-sync.md` | Make E11-T27, T28, T29 and T31 use the exact same product and offline wording. |
| `docs/superpowers/specs/2026-09-10-web-indexeddb-replica-design.md` | State that IndexedDB is the authenticated account replica and that T29 owns offline shell boot. |
| `docs/testing/epic-11-auth-and-sync-e2e-checklist.md` | Replace guest-flow QA scenarios with post-auth offline web/PWA evidence. |

### Task 1: Establish the normative product access and connectivity contract

**Files:** Modify `docs/tz/account-authentication-and-cloud-sync.md` sections 1, 3, 4, 5, 6, 27.3 and 28.

- [ ] Add a titled normative section immediately before the user-state model, with this policy:

  > **Product access policy.** До отдельного продуктового решения пользовательский вход в рабочую область возможен только после регистрации или входа. Это временный режим работы всего продукта, а не QA-режим: завершение Epic 11 не возвращает CTA «Продолжить без аккаунта» и не создаёт новую автономную область. Существующие autonomous/anonymous области сохраняются как изолированные legacy-данные для безопасной миграции или очистки, но не открываются из обычного UI.

- [ ] Add the normative connectivity contract directly below it:

  > **Offline contract.** Сеть обязательна для регистрации, первого входа по email/паролю на устройстве, явной повторной аутентификации и восстановления истёкшей сессии. После успешного онлайн-входа валидная сохранённая сессия открывает приложение без сети; создание, изменение, планирование, завершение и удаление дел выполняются в локальной account-scoped реплике, а sync mutations сохраняются в durable outbox до восстановления сети.

- [ ] Replace user-facing wording in sections 4–6: remove the “Автономный пользователь” state and both “Продолжить без аккаунта” CTAs; add “сохранённая legacy-автономная область” as a non-navigable technical/migration state.
- [ ] Adjust registration/OTP/logout/import passages so they never offer local continuation through a guest CTA. A user with a valid account session may continue the account workspace offline; a user without an account session stays on Auth.
- [ ] Replace E2E items 2–5 in section 27.3 with: first online login; offline restart from a valid session; offline create/edit plus durable outbox; reconnect sync; and legacy-area non-exposure/isolation regression.
- [ ] Add acceptance criteria in section 28 for an expired/absent session offline: do not fabricate login success, show a clear connection-needed Auth state, and never expose another account or legacy area.
- [ ] Review every remaining occurrence of “автономный пользователь”, “автономный старт”, and “Продолжить без аккаунта” in this file. Retain it only when it explicitly denotes retained legacy data or an historical migration input.

### Task 2: Reconcile the source hierarchy and historical Epic promises

**Files:** Modify `docs/tz/account-data-and-cloud-architecture.md`, `docs/tz/epic-00-overview.md`, `docs/tz/epic-01-app-shell-and-local-storage.md`.

- [ ] In `account-data-and-cloud-architecture.md`, add a top-level supersession note: the document remains historical for the pre-E11 implementation; its automatic anonymous identity and anonymous-first startup rules are superseded by the product access and offline contract in `account-authentication-and-cloud-sync.md`.
- [ ] Keep historical facts intact, but add a short cross-reference before “Идентичность пользователя” stating that the described automatic anonymous session is not permission to expose a guest workspace after E11-T27.
- [ ] Replace the first paragraph of `epic-00-overview.md` with wording that preserves offline-first value without promising guest access: “Основной продукт должен быть полезен offline после первой успешной авторизации на устройстве; правила доступа и сети определяет `account-authentication-and-cloud-sync.md`.”
- [ ] Add an E11 override box at the beginning of `epic-01-app-shell-and-local-storage.md`: its original no-registration first-run story is historical; its local persistence, four-tab navigation, and airplane-mode behavior remain requirements for an already authenticated account.
- [ ] Rewrite Epic 01 acceptance wording so “после установки открывается без регистрации” becomes “после первой успешной авторизации повторно открывается без сети при валидной сохранённой сессии.” Remove the criterion that forbids an Auth screen.
- [ ] Confirm cross-links resolve and no document claims both “Auth is absent” and “Auth is mandatory” for the current product.

### Task 3: Align the E11 execution plan and T28 architecture boundary

**Files:** Modify `docs/superpowers/plans/2026-09-01-epic-11-account-auth-and-cloud-sync.md`, `docs/superpowers/specs/2026-09-10-web-indexeddb-replica-design.md`.

- [ ] Expand the 2026-09-10 addendum introduction to state that T27 is product-wide, persists after QA, and can change only through a new approved product decision.
- [ ] Add the precise session/network distinction to T27: new registration and first password sign-in require online verification; a valid existing session must not be gated on network.
- [ ] In T28, specify that IndexedDB persists only the current authenticated account area on web; retained autonomous snapshots are migration backups and not an application entry route.
- [ ] In T29, make offline shell acceptance explicit: a fully closed installed PWA is reopened in airplane mode after a successful online session, renders Auth only when that session is absent/expired, and never caches Supabase/Auth/OTP responses.
- [ ] In T31, replace generic “offline create/edit” with a checklist sequence: online login → close PWA → airplane mode reopen → create/edit → inspect pending outbox → restore network → confirm sync. Add the no-guest-entry regression on both desktop web and iPhone PWA.

### Task 4: Replace obsolete manual QA scenarios

**Files:** Modify `docs/testing/epic-11-auth-and-sync-e2e-checklist.md`.

- [ ] Remove “Автономный старт”, registration after guest work, guest import choice, and login from a guest workspace as ordinary release scenarios.
- [ ] Add “Post-auth offline launch”: register or sign in online, close the PWA/app, enable airplane mode, reopen, and confirm the same account workspace appears without a network error.
- [ ] Add “Offline business work”: create and edit a task and settings offline; verify it persists after another close/reopen and its outbox entry is pending before reconnect.
- [ ] Add “Reconnect”: restore network and verify one successful sync per pending mutation, no duplicate task, and no data loss.
- [ ] Add “No guest regression”: clear/expire the session and confirm Auth offers only registration, sign-in and recovery; it must not surface any existing autonomous/account workspace.
- [ ] Keep legacy-area coverage as a non-user-facing migration fixture: confirm it is not opened automatically and cannot leak into Account A or Account B.

### Task 5: Editorial acceptance and traceability

**Files:** All files listed above; modify `docs/superpowers/plans/2026-09-10-product-access-and-offline-policy-alignment.md` to record completion.

- [ ] Run a targeted wording audit over canonical documents:

  ```powershell
  rg -n "Продолжить без аккаунта|без регистрации|автономный старт|UI входа/регистрации.*исключ" docs/tz docs/testing
  ```

  Classify every match as either historical text with an explicit supersession note, retained legacy/migration data, or a defect to remove.
- [ ] Read the final policy top-to-bottom and check these six assertions: no QA-only interpretation; no public guest entry; legacy data retained; first sign-in network-bound; persisted session offline-capable; offline changes/outbox reconnect-capable.
- [ ] Run `git diff --check` and the existing relevant tests: `npm test -- --runInBand __tests__/application/auth-gate.test.tsx __tests__/data/web-data-indexeddb-migration.test.ts __tests__/pwa-installation-assets.test.ts`.
- [ ] Commit documentation and any QA-checklist update with `docs(policy): align authenticated offline product contract`, then push the current Epic 11 branch. No merge to `main` occurs without explicit instruction.

## Completion criteria

- [ ] One canonical policy states that the product, not only QA, has no guest entry until a future approved change.
- [ ] All MVP/E11 references defer to that policy instead of promising unauthenticated first-run access.
- [ ] The distinction between first online sign-in and offline reopening with a stored valid session is explicit.
- [ ] T28, T29 and T31 together cover durable account data, offline shell boot, local mutation/outbox, and reconnect verification without overlapping claims.
- [ ] The manual E11 checklist contains no user-facing guest scenario and can produce staging evidence for desktop web and installed iPhone PWA.
