# E11-T28 IndexedDB Web Replica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move persistent web business data from legacy `localStorage` snapshots to account-scoped IndexedDB without losing offline data or pending sync mutations.

**Architecture:** `AppDataSource` and the in-memory domain source remain unchanged. A native IndexedDB snapshot store sits behind the current persistent-browser wrapper. The wrapper waits for asynchronous hydration before serving reads; it copies a valid legacy snapshot into IndexedDB, reads it back and validates it before treating migration as successful. The legacy `localStorage` value remains untouched.

**Tech stack:** Expo React Native Web, TypeScript, native IndexedDB API, Jest.

**Spec:** [2026-09-10-web-indexeddb-replica-design.md](../specs/2026-09-10-web-indexeddb-replica-design.md)

## Scope and invariants

- Keep one record per existing `databaseNameForScope(scope)` key. Autonomous and each account scope remain isolated.
- Preserve the existing `AppDataSource` API and synchronous `createDataSource(scope)` factory so `AppServicesProvider` needs no lifecycle redesign.
- Persist the complete current business snapshot, including settings, outbox, sync metadata and conflicts.
- Do not migrate the scope registry or authentication session: they remain separate `localStorage` concerns.
- Never delete, overwrite or mark a legacy `tasktracker.browser-data.<scope>.v1` value as migrated. A failed/corrupt/partial migration must leave it readable.
- A failed IndexedDB write must not leave the in-memory source changed while its persisted snapshot/outbox is stale.
- Do not add service-worker or caching behavior here; that is E11-T29.

## Proposed file changes

| Path | Change |
| --- | --- |
| `src/data/browser-indexeddb-storage.ts` | New native IndexedDB snapshot-store adapter with a small injectable interface for tests. |
| `src/data/data-source.web.ts` | Hydrate `BrowserInMemoryDataSource` from IndexedDB or safely migrate the legacy snapshot; persist mutations transactionally. |
| `__tests__/data/browser-indexeddb-storage.test.ts` | Adapter-level success and failure tests using a deterministic fake IndexedDB factory. |
| `__tests__/data/web-data-indexeddb-migration.test.ts` | Migration, corruption, scope isolation, rollback and offline-reopen tests. |
| `__tests__/data/web-data-scope.test.ts` | Adapt existing scope tests to the new explicit persistent-store dependency. |

## Task 1 — IndexedDB snapshot store

**Files:** create `src/data/browser-indexeddb-storage.ts`; create `__tests__/data/browser-indexeddb-storage.test.ts`

- [ ] Write failing tests for two scope keys: writes are read back independently, a missing scope returns `null`, and an IndexedDB transaction error rejects rather than silently succeeding.
- [ ] Run `npm test -- --runInBand __tests__/data/browser-indexeddb-storage.test.ts` and confirm the expected initial failure.
- [ ] Implement an adapter with these exported contracts:

  ```ts
  export interface BrowserSnapshotRecord<TSnapshot> {
    schemaVersion: 1;
    migratedFromLegacy: boolean;
    snapshot: TSnapshot;
  }

  export interface BrowserSnapshotStore<TSnapshot> {
    read(scopeKey: string): Promise<BrowserSnapshotRecord<TSnapshot> | null>;
    write(scopeKey: string, record: BrowserSnapshotRecord<TSnapshot>): Promise<void>;
  }
  ```

  Use one versioned database (`tasktracker.web-replica.v1`) and one object store (`scopeSnapshots`), with `scopeKey` as its key. Wrap request completion, transaction completion, abort and error events in promises so errors reach the data source.
- [ ] Re-run the target test until green.
- [ ] Commit: `feat(data): add IndexedDB browser snapshot store`.

## Task 2 — Safe legacy migration and hydration

**Files:** modify `src/data/data-source.web.ts`; create `__tests__/data/web-data-indexeddb-migration.test.ts`; modify `__tests__/data/web-data-scope.test.ts`

- [ ] Write a failing test that seeds a valid legacy `localStorage` snapshot, constructs a persistent source, waits for `initialize()`, and asserts the same tasks/settings/outbox are available from IndexedDB after a new source is created.
- [ ] Write failing tests for a corrupt JSON snapshot and a partial snapshot. Both must keep the source usable with a clean in-memory state, leave the legacy raw string unchanged, and create no successful migration record.
- [ ] Run the two migration test files and confirm they fail before implementation.
- [ ] Export/relocate only the snapshot parsing and validation helpers needed for the adapter tests; retain current defaults and validation rules for `projects` and `taskItems`.
- [ ] Add an explicit browser-persistence options object so tests can inject a legacy storage and `BrowserSnapshotStore`:

  ```ts
  export interface BrowserPersistentDataSourceOptions {
    legacyStorage: BrowserScopeStorage;
    snapshotStore: BrowserSnapshotStore<BrowserDataSnapshot>;
  }
  ```

  The source begins from an empty valid snapshot, then its initialization path: (1) loads and validates an IndexedDB record when present; (2) otherwise reads/parses legacy storage, writes a `migratedFromLegacy: true` record, reads it back, validates it, and then hydrates it; (3) on malformed data or any write/readback error stays empty and reports through the existing persistence diagnostic path. Do not call `removeItem` on legacy storage.
- [ ] Preserve `createDataSource(scope)` as a synchronous factory. In browsers it creates the native snapshot store, returns the wrapper immediately, and all public async operations wait for the one shared hydration promise.
- [ ] Re-run target tests until green.
- [ ] Commit: `feat(data): migrate web snapshots to IndexedDB safely`.

## Task 3 — Atomic persistence and rollback

**Files:** modify `src/data/data-source.web.ts`; extend `__tests__/data/web-data-indexeddb-migration.test.ts`

- [ ] Write a failing test with a snapshot store that rejects writes: creating/editing a task rejects and a subsequent read shows neither the mutated task nor a stray outbox command.
- [ ] Add a failing test for `transaction(...)` containing multiple business mutations and outbox writes: one persisted snapshot is attempted at the outer boundary, and a failure restores the complete pre-transaction snapshot.
- [ ] Run the focused test file and confirm expected failures.
- [ ] Expose only the internal snapshot export/restore mechanism necessary to make the proxy wrapper capture a pre-operation snapshot. For every mutation, persist the full post-operation snapshot; if persistence rejects, restore the captured snapshot before rejecting. For nested transactions persist once after the outer transaction and restore that outer pre-transaction snapshot on failure.
- [ ] Ensure sync-outbox methods that use the same underlying source participate in the same wrapper, rather than bypassing persistence.
- [ ] Re-run focused tests until green.
- [ ] Commit: `fix(data): roll back browser mutations when persistence fails`.

## Task 4 — Production wiring and offline proof

**Files:** modify `src/data/data-source.web.ts`; extend `__tests__/data/web-data-indexeddb-migration.test.ts`; modify `__tests__/data/web-data-scope.test.ts`

- [ ] Write a failing “offline reopen” test: hydrate an account source once, create/edit a task while the test has no network transport, discard the source, reopen it from the same IndexedDB store and assert data plus pending outbox remain.
- [ ] Write failing Account A / Account B / autonomous tests that use the production scope keys and prove no snapshot leaks across sources.
- [ ] Implement browser factory selection. If IndexedDB is unavailable (for example SSR or a constrained browser), retain the current legacy `localStorage` wrapper as a safe compatibility fallback; do not destroy either store.
- [ ] Run `npm test -- --runInBand __tests__/data/browser-indexeddb-storage.test.ts __tests__/data/web-data-indexeddb-migration.test.ts __tests__/data/web-data-scope.test.ts`.
- [ ] Run `npm run typecheck`, `npm run lint`, and the full test suite. Inspect the browser bundle only enough to ensure no Node-only IndexedDB shim was introduced.
- [ ] Commit: `test(data): cover IndexedDB offline web replica` and push the current Epic 11 branch.

## Final acceptance checklist

- [ ] Valid legacy autonomous and account snapshots migrate independently, and a reload reads their IndexedDB copies.
- [ ] Settings, outbox, last-sync metadata and conflicts survive reopen.
- [ ] Corrupt/partial migration and IndexedDB write failures preserve the original legacy raw snapshot and do not claim success.
- [ ] A persistence failure rolls in-memory state back together with outbox state.
- [ ] The application can create/edit data while offline after first online initialization, then keep its pending outbox for E11’s later reconnect flow.
- [ ] `npm run typecheck`, `npm run lint`, and full tests are green; any platform limitation is recorded in the Epic 11 report.
