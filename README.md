# TaskTracker

Персональный iOS-планировщик задач с offline-first хранением данных. Приложение
реализуется на Expo, React Native и TypeScript.

## Текущий статус

Реализованы Backlog, планирование, завершение задач, настройки, email-аккаунт и
account-scoped синхронизация. Без аккаунта приложение работает в отдельной
автономной offline-first области. Авторизованный пользователь получает отдельную
локальную реплику: на iPhone она хранится в SQLite, на web — в browser storage.

Облачная синхронизация доступна только после настройки Supabase и завершения
production-предусловий из
[`supabase/production-auth-release-checklist.md`](supabase/production-auth-release-checklist.md).

## Запуск

Требуются Node.js и npm. Из корня проекта выполните:

```bash
npm install
```

Для интерактивного браузерного прототипа на Windows:

```bash
npm run web
```

Откройте адрес Expo из консоли. В web-версии доступны регистрация, автономный
режим, Backlog, план, завершённые задачи и настройки. При доступном browser storage
локальные области сохраняются после обновления страницы.

Для проверки на iPhone через Expo Go:

```bash
npm start
```

Откройте QR-код из консоли в Expo Go. На iPhone локальные области сохраняются в
SQLite после повторного запуска. Для проверки обмена между устройствами укажите
безопасные `EXPO_PUBLIC_SUPABASE_*` значения только в локальном окружении.

## Проверки

```bash
npm test
npm run typecheck
npm run lint
npm run web:export
```

Подробные сценарии ручной проверки:

- [Epic 01 manual checklist](docs/testing/epic-01-manual-checklist.md)
- [Epic 02 manual checklist](docs/testing/epic-02-manual-checklist.md)
- [Epic 11 account and cloud-sync E2E checklist](docs/testing/epic-11-auth-and-sync-e2e-checklist.md)

## Документация

- [Исходное техническое задание](docs/requirements/ТЗ_iOS_планировщик_MVP.docx)
- [Согласованная дизайн-спецификация Epic 01](docs/superpowers/specs/2026-08-01-epic-01-app-shell-design.md)
- [Дизайн закрытия Epic 01](docs/superpowers/specs/2026-08-02-epic-01-completion-design.md)
- [План реализации закрытия Epic 01](docs/superpowers/plans/2026-08-02-epic-01-completion.md)
- [Согласованная дизайн-спецификация Epic 02](docs/superpowers/specs/2026-08-02-epic-02-backlog-design.md)
- [План реализации Epic 02](docs/superpowers/plans/2026-08-02-epic-02-backlog-implementation.md)
- [Технические задания по эпикам](docs/tz/epic-00-overview.md)
- [Интерактивные варианты интерфейса](docs/interface/README.md)
