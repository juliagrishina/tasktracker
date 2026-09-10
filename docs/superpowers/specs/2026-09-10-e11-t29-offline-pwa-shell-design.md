# E11-T29 — Offline PWA shell и безопасное обновление

**Статус:** согласовано для проектирования 2026-09-10
**Связанная карточка:** E11-T29
**Предпосылка:** E11-T28 делает business snapshot account-scoped реплики постоянным в IndexedDB.
**Цель:** после первого успешного online-входа установленная PWA может быть полностью закрыта и затем открыта без сети с валидной сохранённой сессией, не кэшируя ответы Supabase/Auth/OTP и не применяя новую shell-версию посреди работы пользователя.

## Границы

В scope входят:

- генерация service worker после Expo static web export;
- precache только статических файлов export: HTML, JS, CSS, шрифтов, иконок, manifest и favicon;
- регистрация worker в web HTML entry;
- безопасная отложенная активация обновления;
- автоматические проверки регистрации, generated worker и отсутствия runtime-кэша API;
- эксплуатационная инструкция для проверки offline shell на desktop и iPhone PWA.

В scope не входят:

- EAS Hosting, staging URL, deploy или изменение Supabase Redirect URLs — это E11-T30;
- изменение Auth state machine, session storage, IndexedDB business snapshots или sync engine;
- кэширование запросов Supabase, Auth, OTP, profile, sync RPC, Edge Functions или произвольных API-ответов;
- фоновая синхронизация, push, offline-регистрация или offline-первый вход.

## Решение

Используется `workbox-build` как dev dependency и `generateSW()` после `expo export --platform web`. Expo рекомендует Workbox для service worker, а генерируемый worker получает точный manifest хешированных файлов из `dist`; ручной список файлов не вводится.

`npm run web:export` остаётся единой командой production export, но после Expo export запускает локальный script генерации worker. Script:

1. проверяет, что `dist` существует после успешного Expo export;
2. генерирует `dist/sw.js` и вспомогательные Workbox assets только из файлов `dist`;
3. precache’ит HTML, JavaScript, CSS, шрифты, изображения, manifest и favicon;
4. исключает прежний `sw.js`, Workbox runtime files и source maps из input manifest;
5. не задаёт `runtimeCaching`, navigation fallback или network interception.

Такой worker не кэширует ни один HTTP response, который не является файлом build output. В частности, Supabase/Auth/OTP/Edge Function запросы всегда используют обычную сеть; их недоступность обрабатывают существующие Auth и sync слои.

## Регистрация и обновление

`src/app/+html.tsx` добавляет небольшой web-only registration snippet с `navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })` после события `load`.

Worker генерируется с `skipWaiting: false` и `clientsClaim: false`:

- новая worker-версия остаётся waiting, пока открытые страницы и PWA экземпляры используют прежнюю;
- она активируется только после закрытия прежних clients и следующего запуска;
- приложение не перезагружается программно и не меняет shell во время редактирования или pending outbox operation.

Ошибка регистрации намеренно не блокирует приложение и не выводит технические детали в UI или console. Без поддерживаемого service worker web продолжает работать online; persistent business data обеспечивает T28, но закрытая PWA без сети не считается гарантированной до успешной регистрации worker.

## Offline-contract

После успешного online-входа:

1. worker сохраняет уже экспортированную shell;
2. валидная сохранённая Auth-сессия и T28 IndexedDB snapshot восстанавливают ту же account-scoped область;
3. offline CRUD сохраняется локально и добавляет mutation в durable outbox;
4. после возвращения сети sync отправляет pending mutation обычным сетевым путём.

Если сессия отсутствует или истекла, worker может открыть только статический Auth shell. Он не подменяет Auth кэшированным ответом сервера, legacy-областью или данными другого аккаунта; первый вход и re-auth требуют сети.

## Файлы и границы ответственности

- `package.json` — единый скрипт `web:export`, запускающий Expo export и PWA worker generation; dev dependency `workbox-build`.
- `scripts/generate-pwa-service-worker.mjs` — детерминированная конфигурация `generateSW()` и validation output; не содержит секретов и не обращается к сети.
- `src/app/+html.tsx` — только browser registration snippet и PWA metadata; не импортирует service-worker APIs в native runtime.
- `__tests__/pwa-installation-assets.test.ts` и новый test PWA shell — контракты manifest, registration, Workbox configuration и generated export assets.
- `docs/testing/epic-11-auth-and-sync-e2e-checklist.md` — ручные шаги: first online launch, installation, complete close, airplane-mode reopen, offline CRUD/outbox, reconnect и safe update.

## Проверка

Автоматически проверяются:

1. `web:export` создаёт `dist/sw.js` и worker precache manifest содержит shell assets.
2. Worker registration использует root `/sw.js` и `updateViaCache: 'none'`.
3. Конфигурация не содержит `runtimeCaching`, `skipWaiting: true` или `clientsClaim: true`.
4. Export worker и public files не содержат Supabase URL, publishable key, OTP-маршруты, Auth endpoint или injected secret.
5. Manifest и иконки по-прежнему попадают в build output.

Общие проверки: focused Jest tests, `npm run typecheck`, `npm run lint`, полный `npm test`, `npm run web:export` и ручной PWA smoke на desktop/iPhone. Ручной smoke выполняется только после E11-T30 на отдельном HTTPS staging URL: service workers не работают как целевая PWA-проверка через Expo Go, localhost или нестабильный tunnel.

## Ограничения и откат

- `dist` остаётся build artifact и не коммитится.
- Удаление `dist/sw.js` на следующем deploy не гарантирует удаление уже установленного worker у пользователя; rollback должен выпустить новый worker, который удаляет только PWA shell caches и unregisters себя, без доступа к IndexedDB business data.
- T29 не обещает offline-доставку email, регистрацию, login или re-auth.
- На iPhone PWA worker проверяется через «На экран Домой» и HTTPS staging URL после E11-T30; Expo Go остаётся средой native QA и не заменяет PWA shell.
