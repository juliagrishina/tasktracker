# Approved Screen Visual Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Plan B, Backlog 2, Completed 1, and Settings 2 visual compositions in the existing Expo application.

**Architecture:** Continue architecture #2: immutable shared tokens and focused reusable primitives, with feature-specific screen composition. Demo models live beside their feature components and do not alter domain repositories, persistence contracts, or external integrations. Wide web uses a temporary centered responsive composition only.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router 6, React Native Web, TypeScript strict, Jest + jest-expo + React Native Testing Library, `react-native-svg` for the cross-platform progress ring.

## Global Constraints

- Approved screen variants are Plan B, Backlog 2, Completed 1, and Settings 2; the HTML previews in `docs/interface/mockups/` are the visual source of truth.
- Do not change Epic 02 backlog creation, edit, completion, delete, or cascade rules.
- Do not add backend, authentication, Microsoft 365 network access, sync, push notifications, persistent settings editing, or production scheduling.
- Use `designTokens`, `SurfaceCard`, `ActionButton`, and `StatusPill`; source colours and dimensions must not be hard-coded in feature files.
- A mobile visual language remains present at narrow web widths. A centered wide layout is temporary and must not be documented as final web architecture.
- Every visual component is introduced test-first; test the focused file red, then green, then run the relevant suite.
- Commits use `juliagrishina <juliagrishina@users.noreply.github.com>` and push only the current `feature/design-system-ui` branch through its existing SSH remote.

---

### Task 1: Add visual tokens and dashboard ring support

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/ui/design/tokens.ts`, `docs/design/design-system.md`
- Create: `src/ui/plan/progress-ring.tsx`
- Test: `__tests__/ui/plan-dashboard.test.tsx`

**Consumes:** Existing `designTokens` and Expo runtime.

**Produces:** `ProgressRing({ value, label })` that renders the approved blue progress arc and accessible value on iOS and web.

- [x] Write a test that imports `ProgressRing`, renders `value={35}` and `label="35%"`, and asserts that `accessibilityLabel="Выполнено 35%"` is present.
- [x] Run `npm.cmd test -- __tests__/ui/plan-dashboard.test.tsx` and confirm it fails because the component is absent.
- [x] Install the Expo-compatible `react-native-svg`, add only the source-preview progress-track colour role, and implement `ProgressRing` with token values.
- [x] Run `npm.cmd test -- __tests__/ui/plan-dashboard.test.tsx` and confirm the ring test passes.
- [x] Commit the token and ring changes.

### Task 2: Implement Plan B with local demo data

**Files:**
- Create: `src/ui/plan/plan-demo-model.ts`, `src/ui/plan/day-dashboard.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Test: `__tests__/ui/plan-dashboard.test.tsx`

**Consumes:** `ProgressRing`, `SurfaceCard`, `ActionButton`, `designTokens`.

**Produces:** `DayDashboard()` with the approved status card, untimed list, schedule list, and local header-action feedback.

- [x] Add a failing test that renders `DayDashboard` and asserts the visible source-preview landmarks: `Сегодня`, `План в норме`, `Без времени`, `Расписание`, and `Планёрка команды`.
- [x] Run `npm.cmd test -- __tests__/ui/plan-dashboard.test.tsx` and confirm failure because `DayDashboard` is absent.
- [x] Implement the feature-local readonly model and dashboard using the exact approved hierarchy. The day selector, refresh action, and add action only update local visual feedback; they do not write data.
- [x] Replace the development task-list branch in `src/app/(tabs)/index.tsx` with `DayDashboard`, retaining the existing loading state.
- [x] Run the focused test and `npm.cmd run typecheck`; both must pass.
- [x] Commit the Plan B migration.

### Task 3: Bring Backlog 2 to preview parity

**Files:**
- Modify: `src/ui/backlog/backlog-root-screen.tsx`, `src/ui/backlog/category-card.tsx`
- Test: `__tests__/ui/backlog-root.test.tsx`

**Consumes:** Existing Backlog view, category card, tokens, and item actions.

**Produces:** The selected Backlog 2 header/subtitle, informational callout, and category preview metadata without new business behaviour.

- [x] Add a failing assertion for the Backlog subtitle and source-preview callout in `__tests__/ui/backlog-root.test.tsx`.
- [x] Run `npm.cmd test -- __tests__/ui/backlog-root.test.tsx` and confirm the new assertion fails.
- [x] Render dynamic category summaries and preview metadata from the existing Backlog view, adding no search, filter, or scheduling workflow.
- [x] Run `npm.cmd test -- __tests__/ui/backlog-root.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx` and confirm all pass.
- [x] Commit the visual parity update.

### Task 4: Implement Completed 1 as a local archive view

**Files:**
- Create: `src/ui/completed/completed-demo-data.ts`, `src/ui/completed/completed-history-screen.tsx`
- Modify: `src/app/(tabs)/completed.tsx`
- Test: `__tests__/ui/completed-history-screen.test.tsx`

**Consumes:** `SurfaceCard`, `StatusPill`, `designTokens`.

**Produces:** `CompletedHistoryScreen()` with local search, period selection, date groups, type glyphs, item metadata, and non-destructive trailing actions.

- [x] Write a failing test that renders `CompletedHistoryScreen` and asserts `Поиск по названию`, active `Неделя`, `Сегодня`, `Вчера · 2 августа`, and the irreversible-deletion notice.
- [x] Run `npm.cmd test -- __tests__/ui/completed-history-screen.test.tsx` and confirm the component-missing failure.
- [x] Implement immutable completed demo items and the date-group list. Search filters this model in component state; period buttons only alter selected visual state; `•••` exposes local preview feedback without deleting data.
- [x] Replace the development task preview in `src/app/(tabs)/completed.tsx` with `CompletedHistoryScreen`.
- [x] Run the focused test and `npm.cmd run typecheck`; both must pass.
- [x] Commit the Completed 1 migration.

### Task 5: Implement Settings 2 as a demo state panel

**Files:**
- Create: `src/ui/settings/settings-demo-state.ts`, `src/ui/settings/settings-state-panel.tsx`
- Modify: `src/app/(tabs)/settings.tsx`
- Test: `__tests__/ui/settings-state-panel.test.tsx`

**Consumes:** current `AppSettings`, tokens, `SurfaceCard`, `ActionButton`, `StatusPill`.

**Produces:** `SettingsStatePanel({ settings })` with the approved four-card hierarchy and local-only interaction feedback.

- [x] Write a failing test that passes standard settings and asserts `Microsoft 365`, `Подключён`, `Рабочий диапазон`, `Уведомления`, `Удалить локальные данные`, and `Версия 1.0.0`.
- [x] Run `npm.cmd test -- __tests__/ui/settings-state-panel.test.tsx` and confirm the component-missing failure.
- [x] Implement the local Microsoft 365 demo state. The refresh/control buttons and setting rows can change only temporary local status text; they must not authenticate, sync, or persist a setting.
- [x] Replace `src/app/(tabs)/settings.tsx` with the panel, passing the existing settings object.
- [x] Run the focused test and `npm.cmd run typecheck`; both must pass.
- [x] Commit the Settings 2 migration.

### Task 6: Responsive containment, documentation, and verification

**Files:**
- Modify: `src/ui/screen-shell.tsx`, `docs/design/design-system.md`, `docs/design/ui-architecture.md`, `docs/testing/ui-foundations-manual-checklist.md`
- Test: `__tests__/ui/screen-shell.test.tsx`

**Consumes:** Tasks 1–5.

**Produces:** A temporary centered wide-web composition, accurate documentation, and a complete test/manual acceptance record.

- [x] Add a failing test for the temporary content-width constraint exposed by `ScreenShell`.
- [x] Run `npm.cmd test -- __tests__/ui/screen-shell.test.tsx` and confirm the new assertion fails.
- [x] Add a token-based maximum content width only for wide web; narrow views remain full-width with the approved mobile rhythm. Update docs to label this as temporary, not future desktop architecture.
- [x] Update the manual checklist to cover all four selected screens and their mock-only boundaries.
- [x] Run the focused test, then `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run web:export`.
- [x] Run the Impeccable detector against changed UI files, inspect the four routes at 390 px and wide width, and check no horizontal scroll or source-value hardcoding.
- [x] Commit documentation, responsive containment, and final verification changes.

## Plan Self-Review

- Coverage: each selected screen has its own component, route migration, focused test, and visual-source requirements.
- Scope: all new data and actions are local demo state; no domain/data-source or external-service implementation is changed.
- Architecture: tokens and current primitives stay shared; screen composition remains feature-specific.
- Responsive boundary: a bounded wide layout is explicitly temporary and does not prescribe a future desktop design.
