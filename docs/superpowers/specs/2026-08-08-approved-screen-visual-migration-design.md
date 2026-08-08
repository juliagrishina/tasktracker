# Approved Screen Visual Migration Design

**Status:** approved on 8 August 2026.

## Goal

Transfer all four approved mobile screen compositions into the React Native / Expo application: Plan B, Backlog 2, Completed 1, and Settings 2. The HTML previews in `docs/interface/mockups/` remain the visual source of truth.

## Scope

- Preserve the existing shared tokens, primitives, Expo Router structure, and Epic 02 Backlog behaviour.
- Use dedicated feature components for the three new compositions rather than a generic screen renderer.
- Use local demo models and minimal component state where production data or behaviour does not yet exist.
- Do not add backend access, Microsoft 365 authentication, synchronization, push notifications, production schedule editing, or archive deletion.
- Keep the existing four-tab information architecture and deep links.

## Screen Contracts

### Plan B

The screen contains the “Сегодня” header, date, day selector, refresh action, progress ring, plan-status card, nearest event, untimed task list, compact schedule, and floating add action. The visual data is local demo data. The selector and refresh action provide local, non-persistent feedback only.

### Backlog 2

Keep the existing category navigation and item actions. Add the preview header subtitle, the approved informational callout, and richer preview metadata. The source preview’s scheduling text remains explanatory; it does not introduce scheduling logic.

### Completed 1

Render a history grouped by date, archive subtitle, local search input, period pills, completed-item type glyphs, metadata, times, and the irreversible-deletion notice. Search and period choice operate only on a local demo history. The trailing action is a non-destructive preview action.

### Settings 2

Render the Microsoft 365 status card, planning settings card, notification card, Outlook-data danger card, and version/time-zone footer. Existing local application settings provide the planning values. Microsoft 365 identity/status and the actions are demo-only; actions expose local feedback and do not call an external service.

## Responsive Boundary

At narrow widths, web retains the approved mobile composition. At wider widths, the same composition is centered with a temporary maximum readable width; no desktop navigation, side panel, or alternative information architecture is introduced. This is a delivery constraint for the present visual migration, not a final web architecture decision.

## Verification

Each screen receives a focused React Native Testing Library test before production code is added. The completed result must pass the full Jest suite, TypeScript check, Expo lint, static web export, and manual inspection at 390 px plus a wide web viewport.
