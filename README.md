# TaskTracker

Персональный iOS-планировщик задач с offline-first хранением данных. Приложение
реализуется на Expo, React Native и TypeScript. Microsoft 365 будет рассматриваться
отдельно после проверки авторизации и не входит в Epic 01.

## Текущий статус

Epic 01 создал каркас приложения. Epic 02 реализует Backlog: проекты, задачи,
подзадачи и напоминания, вложенную навигацию, локальное хранение и каскадное
завершение. Браузерный прототип обязателен и работает через Expo Web; в web-версии
данные живут только в памяти текущей страницы, а на iPhone сохраняются в SQLite.

## Запуск

Требуются Node.js и npm. Из корня проекта выполните:

```bash
npm install
```

Для интерактивного браузерного прототипа на Windows:

```bash
npm run web
```

Откройте адрес Expo из консоли. В web-версии можно полностью проверить Backlog:
три категории, создание и редактирование элементов, перенос задачи, подзадачи,
завершение и удаление с подтверждением. Данные существуют только в памяти страницы
и пропадают после обновления браузера.

Для проверки на iPhone через Expo Go:

```bash
npm start
```

Откройте QR-код из консоли в Expo Go. На iPhone в development-режиме создаются те
же тестовые карточки, что и в браузере; после повторного запуска Expo Go они должны
сохраниться благодаря SQLite.

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

## Документация

- [Исходное техническое задание](docs/requirements/ТЗ_iOS_планировщик_MVP.docx)
- [Согласованная дизайн-спецификация Epic 01](docs/superpowers/specs/2026-08-01-epic-01-app-shell-design.md)
- [Дизайн закрытия Epic 01](docs/superpowers/specs/2026-08-02-epic-01-completion-design.md)
- [План реализации закрытия Epic 01](docs/superpowers/plans/2026-08-02-epic-01-completion.md)
- [Согласованная дизайн-спецификация Epic 02](docs/superpowers/specs/2026-08-02-epic-02-backlog-design.md)
- [План реализации Epic 02](docs/superpowers/plans/2026-08-02-epic-02-backlog-implementation.md)
- [Технические задания по эпикам](docs/tz/epic-00-overview.md)
- [Интерактивные варианты интерфейса](docs/interface/README.md)
