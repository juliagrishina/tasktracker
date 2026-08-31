# Epic 11 — Account Auth and Cloud Sync Implementation Plan

> **Статус:** декомпозиция согласована 2026-09-01. Реализация не начата.

**Каноническое ТЗ:** [`docs/tz/account-authentication-and-cloud-sync.md`](../../tz/account-authentication-and-cloud-sync.md)

**Текущая архитектура:** [`docs/tz/account-data-and-cloud-architecture.md`](../../tz/account-data-and-cloud-architecture.md)

**Цель:** добавить постоянный email-аккаунт, сохранив автономный режим, затем включить безопасную account-scoped offline-first синхронизацию всех бизнес-данных между iPhone и web.

**Порядок выполнения:** строго `E11-T1` → `E11-T26`. Этап A принимается отдельно до включения пользовательского обещания облачного восстановления. Каждая задача выполняется в собственном scope с target tests и typecheck; полный suite, lint и security/E2E выполняются в `E11-T26`.

## Этап A — аккаунт и локальные области

### E11-T1 — Базовая схема аккаунта в Supabase

- Расширить `profiles`, добавить `legal_acceptances` и `privacy_preferences`, миграцию anonymous users и restrictive anonymous access.
- Слои: `supabase/config.toml`, `supabase/migrations/`, Auth/profile SQL contracts.
- Зависимости: нет.
- Приёмка: миграции идемпотентны, `user.id` сохраняется, anonymous identity не пишет business data и `events`.
- Проверки: migrations, profile trigger, anonymous/authenticated RLS smoke tests.
- Trello: [E11-T1](https://trello.com/c/eZ5BEC9G)

### E11-T2 — Валидация имени, email и пароля

- Добавить общие Unicode-name, IANA TLD/IDN email и password-policy validators для iPhone и web.
- Слои: `src/domain/`, новые auth validation modules, form helpers.
- Зависимости: нет.
- Приёмка: маски и нормализация соответствуют ТЗ, ошибки не раскрывают наличие аккаунта.
- Проверки: name/email/password unit tests.
- Trello: [E11-T2](https://trello.com/c/TJCumcdf)

### E11-T3 — Защищённая Auth-сессия

- Ввести `AuthGateway`, Auth state machine и SecureStore-backed native storage с platform web adapter.
- Слои: `src/data/auth-session.ts`, `src/data/supabase-client.ts`, auth adapters, `app-services-provider.tsx`.
- Зависимости: E11-T1.
- Приёмка: токены отсутствуют в SQLite/open AsyncStorage/logs, service role отсутствует в bundle.
- Проверки: state restore/expiry, native/web adapters, secret scanning.
- Trello: [E11-T3](https://trello.com/c/fWtH5D71)

### E11-T4 — Локальные области по аккаунтам

- Создать registry автономной и account-scoped областей; текущую SQLite безопасно принять как автономную.
- Слои: `src/data/migrations.ts`, data-source factory, native/web persistence, repository bootstrap.
- Зависимости: E11-T3.
- Приёмка: области изолированы, скрываются без удаления, UUID и связи сохранены.
- Проверки: migration, workspace switch/reopen, cross-account isolation.
- Trello: [E11-T4](https://trello.com/c/0LOfiFx6)

### E11-T5 — Первый запуск и экран входа/регистрации

- Добавить Auth gate, формы регистрации/входа и «Продолжить без аккаунта».
- Слои: `src/app/`, новые `src/ui/auth/`, navigation.
- Зависимости: E11-T2–E11-T4.
- Приёмка: first launch открывает Auth, autonomous flow работает offline, формы доступны на iPhone/web.
- Проверки: routing, mode switching, autonomous flow, accessibility.
- Trello: [E11-T5](https://trello.com/c/OzUsJB4u)

### E11-T6 — Регистрация и шестизначный OTP

- Реализовать anonymous linking без смены ID, legal acceptance и OTP: 6 цифр, 10 минут, resend 60 секунд, 3 ошибки.
- Слои: Auth use cases, Supabase adapter, OTP UI, profile/legal repositories.
- Зависимости: E11-T1–E11-T5.
- Приёмка: аккаунт активируется только после кода; пароль до подтверждения хранится только в памяти.
- Проверки: success, expiry, resend, three attempts, restart pending flow.
- Trello: [E11-T6](https://trello.com/c/bwZjS6g9)

### E11-T7 — Вход и выбор судьбы автономных данных

- Реализовать login и явные варианты «Объединить»/«Не переносить» с безопасным импортом локальной области.
- Слои: Auth use cases, workspace import service, Auth UI.
- Зависимости: E11-T4–E11-T6.
- Приёмка: исходная область не удаляется до успеха, UUID/relations сохраняются.
- Проверки: оба выбора, interrupted import/retry, restart.
- Trello: [E11-T7](https://trello.com/c/EowdgKHw)

### E11-T8 — Почтовая инфраструктура и защита Auth

- Настроить русские email templates, production SMTP contract, rate limits, CAPTCHA и scoped one-time action tickets.
- Слои: Supabase Auth configuration, Edge Functions, templates, release config.
- Зависимости: E11-T1, E11-T6.
- Приёмка: секреты не коммитятся, ticket нельзя переиспользовать или применить к другой операции.
- Проверки: template/config contracts, ticket scope/expiry/replay, enumeration protection.
- Trello: [E11-T8](https://trello.com/c/T3xBkQzu)

### E11-T9 — Профиль и изменение email

- Добавить верхний Account block, редактирование имени и смену email через current password + OTP нового адреса.
- Слои: settings UI, profile cache/repository, Auth use cases.
- Зависимости: E11-T2–E11-T8.
- Приёмка: старый email активен до подтверждения, pending change виден и отменяем, статус берётся из Auth.
- Проверки: name online/offline, pending email, cancel/confirm, invalid password/OTP.
- Trello: [E11-T9](https://trello.com/c/4eE2SoCZ)

### E11-T10 — Смена и восстановление пароля

- Реализовать current password + OTP change flow и neutral recovery flow с корректным отзывом сессий.
- Слои: Auth use cases, session registry, Auth/settings UI.
- Зависимости: E11-T2, E11-T3, E11-T8.
- Приёмка: change сохраняет текущую сессию и отзывает остальные; recovery отзывает все старые.
- Проверки: change/recovery, password policy, OTP, online/offline session revocation.
- Trello: [E11-T10](https://trello.com/c/iwFsPSoK)

### E11-T11 — Выход и изоляция области аккаунта

- Реализовать current-session logout без удаления данных, включая offline best-effort revoke.
- Слои: Auth session service, workspace selector, navigation/settings UI.
- Зависимости: E11-T3–E11-T5.
- Приёмка: account area скрыта, autonomous area отдельна, повторный вход возвращает прежние данные.
- Проверки: online/offline logout, relogin, account/autonomous isolation.
- Trello: [E11-T11](https://trello.com/c/K3dmhm1O)

### E11-T12 — Данные аккаунта и автономная очистка

- Переименовать settings section и реализовать удаление только текущей autonomous workspace с подтверждением.
- Слои: settings UI, local workspace management, confirmation UI.
- Зависимости: E11-T4, E11-T9, E11-T11.
- Приёмка: действия зависят от auth state, скрытые account areas не затрагиваются.
- Проверки: conditional UI, clear confirmation, preservation of hidden areas.
- Trello: [E11-T12](https://trello.com/c/2XDFzOoC)

### E11-T13 — Безопасное удаление аккаунта на этапе A

- Реализовать password + OTP + durable deletion request для Auth/profile/legal/privacy и локальной области.
- Слои: Edge Function, `deletion_requests`, Auth/settings UI, local cleanup.
- Зависимости: E11-T8–E11-T12.
- Приёмка: операция идемпотентна, блокирует новые записи, успех только после удаления Auth.
- Проверки: ticket validation, retry after partial failure, session/local cleanup.
- Trello: [E11-T13](https://trello.com/c/bPFdC9GZ)

## Этап B — облачная синхронизация

### E11-T14 — Облачная схема Backlog

- Добавить полные `projects`, `task_items`, `reminders`, versions, tombstone и owner-safe relations.
- Слои: Supabase migrations, database/domain contracts.
- Зависимости: E11-T1.
- Приёмка: server schema сохраняет все текущие SQLite-поля и связи.
- Проверки: schema parity, composite FK, soft delete.
- Trello: [E11-T14](https://trello.com/c/KbklFRWx)

### E11-T15 — Облачная схема планирования и настроек

- Добавить planning, recurrence, transfer, energy, settings, devices и `account_state` tables.
- Слои: Supabase migrations, planning/settings contracts.
- Зависимости: E11-T14.
- Приёмка: все синхронизируемые сущности представлены; shared/device-specific data разделены.
- Проверки: planning/recurrence/energy/settings schema contracts.
- Trello: [E11-T15](https://trello.com/c/e02gDNED)

### E11-T16 — RLS, grants и серверные инварианты

- Закрыть cross-account доступ, anonymous access, direct client mutations и hard delete.
- Слои: Supabase SQL policies/grants, security harness.
- Зависимости: E11-T14, E11-T15.
- Приёмка: user A не может читать/менять/связывать data B и обходить optimistic concurrency.
- Проверки: A/B, anonymous JWT, forged owner, direct mutation/delete.
- Trello: [E11-T16](https://trello.com/c/Ea60yEMA)

### E11-T17 — Локальный outbox и sync metadata

- Добавить transactional outbox, cursor, device ID, versions и data generation во все mutating repositories.
- Слои: SQLite migrations, native/web data sources, repositories.
- Зависимости: E11-T4, E11-T14, E11-T15.
- Приёмка: entity и outbox всегда commit/rollback вместе; business changes работают offline.
- Проверки: atomicity, mutation payload, all mutation paths.
- Trello: [E11-T17](https://trello.com/c/UrHNeYBj)

### E11-T18 — Серверный sync protocol

- Реализовать JWT-owned apply RPC, mutation idempotency, version conflicts, `sync_changes`, cursor, tombstone и data-generation protection.
- Слои: Supabase SQL/RPC, Edge Function, sync contracts.
- Зависимости: E11-T16, E11-T17.
- Приёмка: duplicate mutation безопасен; stale version конфликтует; stale generation отклоняется.
- Проверки: retry/duplicate, cursor resume, tombstone, dependency ordering.
- Trello: [E11-T18](https://trello.com/c/MRZWNext)

### E11-T19 — Клиентский push/pull sync engine

- Добавить batching, transactional pull, retry/backoff и lifecycle/network/realtime/manual triggers.
- Слои: новые `src/application/sync/`, lifecycle/network integration, Supabase sync client.
- Зависимости: E11-T17, E11-T18.
- Приёмка: interrupted sync безопасно продолжается, cursor commit следует только после local transaction.
- Проверки: interrupted push/pull, reconnect, debounce, foreground, concurrent run.
- Trello: [E11-T19](https://trello.com/c/OpV80TCh)

### E11-T20 — Первичная синхронизация и объединение

- Реализовать first upload/download, согласованный merge/no-transfer и full resync без дубликатов.
- Слои: sync orchestration, workspace importer, post-login flow.
- Зависимости: E11-T7, E11-T19.
- Приёмка: источник не удаляется до успеха, UUID/relations сохраняются, retry идемпотентен.
- Проверки: new/existing account, both choices, failure/retry.
- Trello: [E11-T20](https://trello.com/c/aE722KwF)

### E11-T21 — Разрешение конфликтов

- Хранить и показывать обе версии; поддержать edit/edit и edit/delete решения с новой server version.
- Слои: conflict persistence/use cases, sync engine, conflict UI.
- Зависимости: E11-T18–E11-T20.
- Приёмка: конфликт не блокирует другие сущности, повторное решение не создаёт loop.
- Проверки: edit/edit, edit/delete, both choices, redelivery.
- Trello: [E11-T21](https://trello.com/c/RO2dwUHb)

### E11-T22 — Межустройственные часовые пояса

- Нормализовать exact instants/source IANA zone, recurrence conversion, floating dates и notification reschedule.
- Слои: domain time model, persistence/sync mappers, recurrence, notifications.
- Зависимости: E11-T15, E11-T19.
- Приёмка: Moscow 10:00 → Nha Trang 14:00; no-time date не сдвигается.
- Проверки: two zones, DST, recurrence, floating dates, notifications.
- Trello: [E11-T22](https://trello.com/c/BVKKc1CD)

### E11-T23 — Состояние синхронизации в настройках

- Добавить все согласованные sync states, pending count, last success, retry/manual sync и conflict navigation.
- Слои: settings UI, sync state service/selectors.
- Зависимости: E11-T19, E11-T21.
- Приёмка: UI неблокирующий и не показывает SQL/JWT/internal payload.
- Проверки: all states, manual retry, pending count, accessibility.
- Trello: [E11-T23](https://trello.com/c/rP9M8ckR)

### E11-T24 — Очистка всех данных аккаунта

- Реализовать protected clear-data action, increment `data_generation`, server/local wipe и stale outbox rejection при сохранении Auth/profile/legal data.
- Слои: Edge Function/RPC, `account_state`, sync engine, settings UI.
- Зависимости: E11-T8, E11-T18–E11-T23.
- Приёмка: пользователь остаётся авторизованным в пустом приложении; offline device не восстанавливает удалённое.
- Проверки: clear, secondary offline device, stale generation/outbox, retained account data.
- Trello: [E11-T24](https://trello.com/c/yJBaabee)

### E11-T25 — Полное удаление синхронизированного аккаунта

- Расширить durable deletion на весь cloud graph, Auth, sessions и local replicas всех устройств.
- Слои: `deletion_requests`, Edge Function, sync/auth clients, workspace cleanup.
- Зависимости: E11-T13, E11-T18–E11-T24.
- Приёмка: partial failure безопасно повторяется; после успеха login невозможен.
- Проверки: full graph, DB/Auth boundary failure, offline device, repeated request.
- Trello: [E11-T25](https://trello.com/c/ba4KjXaY)

### E11-T26 — Сквозная приёмка и release hardening

- Выполнить весь unit/integration/RLS/security/E2E scope раздела 27 на web и реальном iPhone; проверить feature flags и production checklist.
- Слои: `__tests__/`, Supabase test harness, E2E/release configuration, `docs/tz/`.
- Зависимости: E11-T1–E11-T25.
- Приёмка: full suite, typecheck и lint проходят; выполнены все 14 E2E-сценариев; незавершённые cloud claims скрыты.
- Проверки: полный раздел 27, два устройства, offline, conflicts, Moscow/Nha Trang, clear/delete.
- Trello: [E11-T26](https://trello.com/c/U06rPktF)

## Общие ограничения

- Не добавлять phone auth, Apple/Google/Microsoft login, MFA, team accounts, public profiles, avatars или export.
- Не синхронизировать пароли, Supabase/Microsoft tokens, iOS permissions, notification IDs и технический cache.
- Не обещать cloud restore пользователю до прохождения E11-T26.
- Не переносить автономные данные без явного выбора пользователя.
- Не объединять scope соседних карточек без отдельного согласования.
