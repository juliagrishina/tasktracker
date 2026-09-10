# E11-T28 — Web-реплика в IndexedDB без потери offline-данных

**Статус:** согласовано для планирования 2026-09-10
**Связанная карточка:** E11-T28
**Цель:** после первой онлайн-авторизации web/PWA сохраняет account-scoped offline-first реплику в IndexedDB, не теряя уже существующие web-данные из `localStorage`.

## Границы

В scope входят только данные web-реплики `AppDataSource`:

- каждая известная account area, а также ранее сохранённая autonomous область как
  изолированный legacy snapshot для миграции или очистки, не как пользовательский
  режим;
- настройки и бизнес-сущности;
- sync state, cursor, entity versions, outbox и conflicts.

В scope не входят service worker, кэширование app shell и публикация staging PWA: это E11-T29 и E11-T30. Supabase-сессия и реестр известных account scopes остаются в своём существующем localStorage-адаптере: они не являются business snapshot и не мигрируются этой задачей.

## Решение

Используется нативный IndexedDB без дополнительной библиотеки. Это исключает новую зависимость из web bundle и оставляет контролируемым путь миграции.

В базе `tasktracker.web-replica.v1` создаётся object store `scopeSnapshots`. Один ключ равен `databaseNameForScope(scope)`; одна запись содержит:

- `schemaVersion`;
- канонический `BrowserDataSnapshot` текущей области;
- признак успешной миграции legacy snapshot.

Одна запись на область сохраняет существующую семантику `AppDataSource`: бизнес-изменение и добавление соответствующего outbox mutation фиксируются одним IndexedDB `put` после успешной транзакции. Нормализованная IndexedDB-схема с отдельными таблицами не вводится: она расширила бы E11-T28 без пользовательской пользы и изменила бы проверенную доменную границу.

## Инициализация и миграция

`createDataSource(scope)` остаётся синхронной фабрикой. Возвращаемый web source создаётся сразу, но все его асинхронные методы ожидают единый `ready` promise до первого чтения или изменения. Поэтому UI и существующий `AppDataSource` interface не меняются.

При первой инициализации области:

1. Если в IndexedDB есть валидная запись с поддерживаемой версией схемы, она становится источником истины.
2. Если записи нет, адаптер читает legacy ключ `tasktracker.browser-data.<scope>.v1` из `localStorage`.
3. Валидный snapshot нормализуется теми же правилами, что текущий web adapter: отсутствующие необязательные массивы получают пустое значение, обязательные `projects` и `taskItems` должны быть массивами.
4. Snapshot записывается в IndexedDB, затем немедленно читается обратно и повторно валидируется. Только после этого область считается мигрированной.
5. Legacy ключ не удаляется и не перезаписывается. Он остаётся читаемым резервом до отдельной будущей задачи очистки.

Если legacy JSON повреждён, не проходит валидацию или IndexedDB write/readback завершается ошибкой, миграция не получает marker успеха и legacy snapshot остаётся нетронутым. Адаптер начинает с пустой области только в памяти; первая последующая успешная пользовательская запись создаёт новую IndexedDB-запись, но не удаляет legacy данные.

## Атомарность и восстановление

Persistent wrapper сохраняет snapshot только после успешного завершения бизнес-операции. Для одиночной mutation и для `transaction()` он снимает snapshot до изменения. Если IndexedDB не подтверждает запись, wrapper восстанавливает этот снимок в памяти и отклоняет операцию. Это сохраняет согласованность бизнес-данных и outbox.

Области изолированы ключом `databaseNameForScope`; запись Account A не читает, не обновляет и не заменяет запись Account B или legacy autonomous area. После E11-T27 автономный snapshot не даёт пользовательского входа в рабочую область и остаётся только безопасным источником миграции/очистки.

В средах без IndexedDB (SSR и Jest без injected fake) сохраняется текущий in-memory fallback. Он не объявляется persistent storage и не запускает legacy migration.

## Компоненты

- `src/data/browser-indexeddb-storage.ts` — небольшой port для открытия базы, чтения и атомарной записи snapshot; production implementation использует native IndexedDB.
- `src/data/data-source.web.ts` — lazy hydration, вызов legacy migration и rollback при ошибке persistence; публичная фабрика `createDataSource` не меняет сигнатуру.
- `__tests__/data/web-data-scope.test.ts` и новые migration tests — fake IndexedDB port и legacy storage для воспроизводимых сценариев без настоящего браузера.

## Проверка

Автоматически проверяются:

1. Миграция валидного legacy autonomous и account snapshot со всеми sync-полями.
2. Неполный совместимый snapshot: defaults применяются без потери существующих строк.
3. Повреждённый JSON и сбой write/readback: legacy значение остаётся читаемым и не помечается мигрированным.
4. Изоляция legacy autonomous, Account A и Account B после повторного создания data source.
5. Create/edit и enqueue outbox → reload → offline reopen → последующая синхронизация; snapshot не теряет pending mutation.
6. Ошибка IndexedDB persistence откатывает и business mutation, и outbox mutation.

Общие проверки: target Jest tests, `npm run typecheck`, `npm run lint`, полный `npm test` и `npm run web:export`.

## Ограничения

Service worker и возможность открыть полностью выгруженную страницу без сети намеренно не реализуются здесь: T28 делает данные persistent, а T29 добавит offline app shell. IndexedDB не синхронизируется между браузерами или устройствами сам по себе; межустройственная синхронизация остаётся существующей функцией Supabase sync engine.
