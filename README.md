# TaskTracker

Персональный iOS-планировщик задач с offline-first хранением данных. Приложение реализуется на Expo, React Native и TypeScript. Интеграция Microsoft 365 не входит в текущий MVP.

## Текущий статус

Epic 01 создал каркас приложения, а Epic 02 — Backlog: проекты, задачи, подзадачи, напоминания, вложенную навигацию, локальное хранение и каскадное завершение.

Epic 03 добавляет планирование: дата или период, несколько временных блоков на пяти‑минутной сетке, повторения, независимые исключения экземпляров, расчёт загрузки и реальные данные в представлениях «День», «Неделя» и «Месяц». Пересечение блоков требует явного решения пользователя. Напоминание не получает временной блок напрямую: сначала оно атомарно преобразуется в задачу с выбранным проектом или без него.

Web-прототип использует in-memory источник: данные существуют только до обновления страницы. На iPhone используется SQLite; ручная проверка этой границы описана в чек-листе ниже.

## Запуск

Требуются Node.js и npm. Из корня проекта:

```bash
npm ci
```

Для интерактивного браузерного прототипа на Windows:

```bash
npm run web
```

Для проверки на iPhone через Expo Go:

```bash
npm start
```

## Проверки

```bash
npm test
npm run typecheck
npm run lint
npm run web:export
```

Ручные сценарии:

- [Epic 01 manual checklist](docs/testing/epic-01-manual-checklist.md)
- [Epic 02 manual checklist](docs/testing/epic-02-manual-checklist.md)
- [Epic 03 manual checklist](docs/testing/epic-03-manual-checklist.md)

## Документация

- [Исходное техническое задание](docs/requirements/ТЗ_iOS_планировщик_MVP.docx)
- [Спецификация Epic 03](docs/superpowers/specs/2026-08-13-epic-03-scheduling-design.md)
- [План реализации Epic 03](docs/superpowers/plans/2026-08-13-epic-03-scheduling-implementation.md)
- [Технические задания по эпикам](docs/tz/epic-00-overview.md)
- [Интерактивные варианты интерфейса](docs/interface/README.md)
