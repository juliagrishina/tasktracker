# Epic 02 — Backlog и управление делами: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать интерактивный Backlog для создания, организации, завершения и безопасного удаления проектов, задач, подзадач и напоминаний в iPhone-приложении и браузерном прототипе.

**Architecture:** Слой домена хранит форму и инварианты сущностей, use cases выполняют валидацию, каскадные операции и формирование детерминированного Backlog-представления, а `AppDataSource` реализует эти операции в SQLite и in-memory web-хранилище. Вкладка Backlog остаётся дочерним навигационным стеком постоянного tab bar; внутренние экраны читают готовое представление у provider и передают намерения в use cases.

**Tech Stack:** React Native, Expo Router, Expo SQLite, TypeScript strict, Jest + jest-expo + React Native Testing Library.

## Global Constraints

- Пользовательский интерфейс — русский, iPhone portrait, нижнее меню всегда содержит «План», `Backlog`, «Завершённые», «Настройки».
- Использовать только локальные SQLite и in-memory web-хранилище; никаких сетевых запросов, сервера, авторизации, iCloud, поиска и фильтров.
- Проект завершается вместе с задачами и подзадачами; задача завершается вместе с прямыми подзадачами; подзадача и напоминание завершаются сами по себе.
- Удаление незавершённого элемента доступно только после явного подтверждения. Удаление проекта переводит его задачи в «Без проекта», а удаление задачи удаляет только её прямые подзадачи.
- Дата, время, временные блоки, конфликты и расчёт повторений не реализуются до Epic 03. «Запланировать» — ясная точка входа без записи данных.
- Каждый новый сценарий пишется по TDD: сначала тест и подтверждённое ожидаемое падение, затем минимальная реализация.
- После каждого законченного задания создавать коммит от `juliagrishina <juliagrishina@users.noreply.github.com>`; перед завершением Epic 02 отправить проверенные коммиты в GitHub по SSH.

---

## File structure

| Файл | Ответственность |
| --- | --- |
| `src/domain/entities.ts` | Расширенные типы Backlog-сущностей и правила повторения. |
| `src/domain/backlog-invariants.ts` | Валидация названия, длительности, периода и правила повторения. |
| `src/data/contracts.ts` | Контракт выборки, транзакций и удаления данных. |
| `src/data/migrations.ts` | Миграция SQLite v3 без потери существующих строк. |
| `src/data/data-source.native.ts` / `src/data/data-source.web.ts` | Нативное и браузерное хранение полного состояния Backlog. |
| `src/application/backlog-types.ts` | DTO намерений и подготовленные view-модели Backlog. |
| `src/application/backlog-use-cases.ts` | Создание, изменение, группировка, перенос, каскадное завершение и удаление. |
| `src/application/app-services.ts` / `app-services-provider.tsx` | Подключение Backlog-сценариев и реактивное обновление UI. |
| `src/ui/backlog/*` | Карточки категорий, строки деревьев, sheet форм, детали и подтверждение. |
| `src/app/(tabs)/backlog/**` | Иерархические маршруты Backlog внутри существующей вкладки. |
| `__tests__/domain/backlog-invariants.test.ts` | Инварианты пользовательских полей. |
| `__tests__/application/backlog-use-cases.test.ts` | Реальные сценарии, включая каскады. |
| `__tests__/data/backlog-data-source.test.ts` | Одинаковое хранение и сортировка web-источника. |
| `__tests__/data/migrations.test.ts` | Применение миграции v3. |
| `__tests__/ui/backlog-*.test.tsx` | Интерактивные UI-сценарии и отсутствие поиска/фильтров. |
| `docs/testing/epic-02-manual-checklist.md` | Ручная проверка браузерного прототипа и iPhone. |

## Task 1: Backlog-доменные поля и инварианты

**Files:**
- Modify: `src/domain/entities.ts`
- Create: `src/domain/backlog-invariants.ts`
- Modify: `src/domain/invariants.ts`
- Modify: `src/domain/reminder-conversion.ts`
- Test: `__tests__/domain/backlog-invariants.test.ts`
- Modify: `__tests__/domain/reminder-conversion.test.ts`, `__tests__/domain/invariants.test.ts`

**Consumes:** Текущие `Project`, `TaskItem`, `Reminder` и инвариант последнего уровня подзадачи.

**Produces:** Типы `BacklogRepeatFrequency`, `BacklogRepeatRule`, расширенные сущности со статусом `completedAt`, а также `assertBacklogText`, `assertEstimatedDuration`, `assertReminderScheduleShape`.

- [ ] **Step 1: Написать падающие тесты домена**

```ts
test('rejects a blank project title and a zero task duration', () => {
  expect(() => assertBacklogText('   ', 'Название')).toThrow('Название обязательно');
  expect(() => assertEstimatedDuration(0)).toThrow('Длительность должна быть больше нуля');
});

test('requires a complete and ordered reminder period', () => {
  expect(() => assertReminderScheduleShape({
    remindsOn: null,
    periodStartOn: '2026-08-10',
    periodEndOn: null,
    repeatRule: null,
  })).toThrow('Период напоминания должен иметь начало и конец');
});
```

- [ ] **Step 2: Запустить тест и подтвердить ожидаемое падение**

Run: `npm test -- __tests__/domain/backlog-invariants.test.ts`

Expected: FAIL, поскольку модуль `backlog-invariants` и функции проверки ещё не существуют.

- [ ] **Step 3: Добавить минимальные типы и проверки**

```ts
export interface BacklogRepeatRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
}

export interface Project {
  id: EntityId;
  title: string;
  description: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function assertEstimatedDuration(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    throw new Error('Длительность должна быть больше нуля');
  }
}
```

Make every `TaskItem` carry `description`, `estimatedDurationMinutes` and `completedAt`. Replace the legacy `Reminder` scheduling shape with `remindsOn`, optional ordered `periodStartOn` / `periodEndOn`, optional `repeatRule`, `estimatedDurationMinutes` and `completedAt`; it has no `projectId` or parent task reference. Preserve conversion by copying the reminder title into a standalone task with empty optional values.

- [ ] **Step 4: Обновить старые fixtures и подтвердить зелёные тесты**

Run: `npm test -- __tests__/domain/backlog-invariants.test.ts __tests__/domain/invariants.test.ts __tests__/domain/reminder-conversion.test.ts`

Expected: PASS. Existing hierarchy tests still reject subtask nesting.

- [ ] **Step 5: Commit**

```bash
git add src/domain __tests__/domain
git commit -m "feat: add backlog domain fields and validation"
```

## Task 2: SQLite v3 и единый контракт хранения Backlog

**Files:**
- Modify: `src/data/contracts.ts`
- Modify: `src/data/migrations.ts`
- Modify: `src/data/data-source.native.ts`
- Modify: `src/data/data-source.web.ts`
- Modify: `src/application/demo-data.ts`
- Test: `__tests__/data/backlog-data-source.test.ts`
- Modify: `__tests__/data/in-memory-data-source.test.ts`, `__tests__/data/migrations.test.ts`

**Consumes:** Расширенные сущности и проверки из Task 1.

**Produces:** `listProjects`, `listTaskItems`, `listReminders`, `listScheduleBlocks`, `deleteProject`, `deleteTaskItem`, `deleteReminder` и `transaction`; SQLite v3 сохраняет все новые поля и преобразует legacy reminder rows.

- [ ] **Step 1: Написать падающие тесты источника и миграции**

```ts
test('keeps a saved unassigned task and its subtask in deterministic order', async () => {
  const source = createInMemoryDataSource();
  await source.saveTaskItem(taskCreatedAtNine);
  await source.saveTaskItem(subtaskCreatedAtTen);

  await expect(source.listTaskItems()).resolves.toEqual([
    taskCreatedAtNine,
    subtaskCreatedAtTen,
  ]);
});

test('applies migration three to a version-two database', async () => {
  const database = new MigrationDatabase(2);
  await migrateDatabase(database as never);
  expect(database.executedSql.join('\n')).toContain('reminders_v3');
  expect(database.appliedVersions).toEqual([3]);
});
```

- [ ] **Step 2: Запустить тесты и подтвердить падение**

Run: `npm test -- __tests__/data/backlog-data-source.test.ts __tests__/data/migrations.test.ts`

Expected: FAIL, потому что список и migration v3 отсутствуют.

- [ ] **Step 3: Добавить контракт и migration v3**

```ts
export interface AppDataSource {
  // existing methods
  listProjects(): Promise<readonly Project[]>;
  listTaskItems(): Promise<readonly TaskItem[]>;
  listReminders(): Promise<readonly Reminder[]>;
  listScheduleBlocks(): Promise<readonly ScheduleBlock[]>;
  deleteProject(id: EntityId): Promise<void>;
  deleteTaskItem(id: EntityId): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
```

Migration v3 creates `reminders_v3` with nullable `reminds_on`, nullable paired period columns, nullable repeat columns, nullable duration and `completed_at`; it copies title, creation time and `date(reminds_at)` from old rows, drops `reminders`, renames `reminders_v3`, and adds nullable description/completion/duration columns to projects and task items. Keep the migration list append-only.

Native source maps each SQL row exactly to the new domain type, uses `withTransactionAsync` in `transaction`, and orders all `list*` results by `created_at ASC, id ASC`. Web source mirrors list, delete and transaction behavior using Maps and a snapshot rollback on rejected operations. Rebuild demo data with every new required property and a reminder without a date so root Backlog has real sample content.

- [ ] **Step 4: Проверить source- и migration-тесты**

Run: `npm test -- __tests__/data/backlog-data-source.test.ts __tests__/data/in-memory-data-source.test.ts __tests__/data/migrations.test.ts`

Expected: PASS, including existing data round trips.

- [ ] **Step 5: Commit**

```bash
git add src/data src/application/demo-data.ts __tests__/data
git commit -m "feat: persist backlog entity details locally"
```

## Task 3: Backlog view-модель и сценарии управления

**Files:**
- Create: `src/application/backlog-types.ts`
- Create: `src/application/backlog-use-cases.ts`
- Modify: `src/application/app-services.ts`
- Test: `__tests__/application/backlog-use-cases.test.ts`

**Consumes:** Transactional `AppDataSource` from Task 2.

**Produces:** DTO для создания/изменения, `getBacklogView`, `createBacklogItem`, `updateBacklogItem`, `moveTaskToProject`, `completeBacklogItem`, `deleteBacklogItem`.

- [ ] **Step 1: Написать падающие use-case тесты**

```ts
test('completes a project with its tasks and subtasks in one cascade', async () => {
  await completeBacklogItem(source, { kind: 'project', id: project.id, completedAt });

  await expect(source.getProject(project.id)).resolves.toMatchObject({ completedAt });
  await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ completedAt });
  await expect(source.getTaskItem(subtask.id)).resolves.toMatchObject({ completedAt });
});

test('deleting a project keeps its tasks as unassigned', async () => {
  await deleteBacklogItem(source, { kind: 'project', id: project.id, confirmed: true });
  await expect(source.getTaskItem(task.id)).resolves.toMatchObject({ projectId: null });
});
```

- [ ] **Step 2: Запустить и подтвердить ожидаемое падение**

Run: `npm test -- __tests__/application/backlog-use-cases.test.ts`

Expected: FAIL, поскольку use cases ещё не существуют.

- [ ] **Step 3: Реализовать минимальные сценарии**

```ts
export async function completeBacklogItem(
  source: AppDataSource,
  input: CompleteBacklogItemInput,
): Promise<void> {
  await source.transaction(async () => {
    // find selected entity; retain a non-null completedAt unchanged
    // for a task update direct subtasks; for a project update every task in that project
  });
}
```

`getBacklogView` returns `{ reminders, unassignedTasks, projects }`, removes completed entries, removes task entries having a schedule block, and returns category arrays in the fixed order. It sorts projects with `Intl.Collator('ru')` by title then `createdAt` then `id`; tasks, subtasks and reminders use `createdAt` then `id`.

`deleteBacklogItem` throws `Требуется подтверждение удаления` unless `confirmed` is true. It makes no changes before that check. A project update first detaches all direct tasks (`projectId: null`) and keeps subtasks. A task delete relies on the source’s task-child cascade only after confirmation. Creation and editing trim title, turn an empty description into `null`, preserve all unspecified editable fields, and validate every DTO with Task 1 functions.

- [ ] **Step 4: Проверить сценарии и регрессии конверсии**

Run: `npm test -- __tests__/application/backlog-use-cases.test.ts __tests__/application/convert-reminder-to-task.test.ts`

Expected: PASS; tests cover minimal creation of each type, move both directions, deterministic grouping, all completion cascades, preserved first completion date and confirmed deletion.

- [ ] **Step 5: Commit**

```bash
git add src/application __tests__/application/backlog-use-cases.test.ts
git commit -m "feat: add backlog management use cases"
```

## Task 4: Реактивные сервисы и подготовка development-данных

**Files:**
- Modify: `src/application/app-services-provider.tsx`
- Modify: `src/application/app-services.ts`
- Modify: `src/application/demo-data.ts`
- Test: `__tests__/application/app-services.test.tsx`
- Test: `__tests__/application/demo-data.test.ts`

**Consumes:** Backlog use cases and `BacklogView` from Task 3.

**Produces:** `useAppServices()` exposes `backlog`, `refreshBacklog()` and `runBacklogAction()` while UI never sees raw source or SQLite.

- [ ] **Step 1: Написать падающий тест provider**

```tsx
test('refreshes the backlog view after creating an unassigned task', async () => {
  const source = createInMemoryDataSource();
  render(<AppServicesProvider source={source} seedDevelopmentData={false}><Probe /></AppServicesProvider>);

  await userEvent.press(screen.getByText('Создать задачу'));
  expect(await screen.findByText('Новая задача')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Запустить и подтвердить падение**

Run: `npm test -- __tests__/application/app-services.test.tsx`

Expected: FAIL, потому что context не публикует backlog view или action.

- [ ] **Step 3: Реализовать обновление provider**

```ts
interface AppServicesContextValue {
  isReady: boolean;
  backlog: BacklogView;
  refreshBacklog(): Promise<void>;
  runBacklogAction<T>(action: () => Promise<T>): Promise<T>;
}
```

`runBacklogAction` awaits the use case, then calls `refreshBacklog`; on error it rethrows it so form can leave entered values visible. `seedDemoData` is idempotent and contains минимум один reminder without date, одну задачу без проекта, один проект с задачей и подзадачей. Existing Plan and Completed preview fixtures are adapted to the expanded entities without adding production-only seeded content.

- [ ] **Step 4: Проверить provider и demo data**

Run: `npm test -- __tests__/application/app-services.test.tsx __tests__/application/demo-data.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application __tests__/application/app-services.test.tsx __tests__/application/demo-data.test.ts
git commit -m "feat: expose reactive backlog services"
```

## Task 5: Вложенная навигация Backlog и переиспользуемые UI-компоненты

**Files:**
- Delete: `src/app/(tabs)/backlog.tsx`
- Create: `src/app/(tabs)/backlog/_layout.tsx`
- Create: `src/app/(tabs)/backlog/index.tsx`
- Create: `src/app/(tabs)/backlog/reminders.tsx`
- Create: `src/app/(tabs)/backlog/unassigned.tsx`
- Create: `src/app/(tabs)/backlog/projects.tsx`
- Create: `src/app/(tabs)/backlog/project/[id].tsx`
- Create: `src/app/(tabs)/backlog/item/[id].tsx`
- Create: `src/ui/backlog/category-card.tsx`
- Create: `src/ui/backlog/tree-list.tsx`
- Create: `src/ui/backlog/item-form-sheet.tsx`
- Create: `src/ui/backlog/item-detail-actions.tsx`
- Create: `src/ui/backlog/confirmation.ts`
- Modify: `src/ui/screen-shell.tsx`
- Test: `__tests__/ui/backlog-root.test.tsx`
- Test: `__tests__/ui/backlog-form.test.tsx`
- Test: `__tests__/ui/backlog-actions.test.tsx`

**Consumes:** `BacklogView` and action functions from the provider.

**Produces:** Все маршруты и интерактивные сценарии Epic 02, остающиеся внутри tab `Backlog`.

- [ ] **Step 1: Написать падающие UI-тесты корня и формы**

```tsx
test('shows exactly three backlog categories in the approved order without search', () => {
  render(<BacklogRootScreen />);
  expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel))
    .toEqual(expect.arrayContaining(['Напоминания', 'Без проекта', 'Проекты']));
  expect(screen.queryByPlaceholderText(/поиск/i)).toBeNull();
});

test('keeps the form open and shows validation after saving a blank title', async () => {
  render(<ItemFormSheet visible mode="create" type="task" />);
  await userEvent.press(screen.getByText('Сохранить'));
  expect(screen.getByText('Название обязательно')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Запустить и подтвердить падение**

Run: `npm test -- __tests__/ui/backlog-root.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx`

Expected: FAIL, поскольку компоненты и маршруты ещё не существуют.

- [ ] **Step 3: Реализовать root, вложенные экраны и sheets**

Use `Stack` in `src/app/(tabs)/backlog/_layout.tsx`, so the tab bar stays managed by the parent `(tabs)` layout. `index.tsx` renders the three `CategoryCard` components in fixed order and a 44×44 pt labelled `+` action. Each card has a native-style white rounded card, count and maximum two preview strings.

`ItemFormSheet` uses React Native `Modal` with `animationType="slide"`, `TextInput` fields and accessible text buttons. It presents only relevant optional fields per entity type. The project choice for a task is a sheet list with an explicit «Без проекта» entry. Subtask creation is available from a task only; the subtask detail has no add-child action.

`confirmation.ts` calls `Alert.alert` on iOS and `window.confirm` on web; both paths must require an affirmative result before invoking a destructive use case. Detail actions call the provider, return to the refreshed parent screen on successful deletion or completion, and show an in-screen Russian result or error text. The `Запланировать` button opens a non-mutating explanatory sheet: «Выбор даты и времени появится на следующем этапе планирования».

- [ ] **Step 4: Дописать проверку каскадов и подтвердить UI-тесты**

```tsx
test('does not delete a selected task until deletion is confirmed', async () => {
  mockConfirmation(false);
  render(<ItemDetailScreen item={taskWithSubtask} />);
  await userEvent.press(screen.getByText('Удалить'));
  expect(source.getTaskItem(taskWithSubtask.id)).resolves.not.toBeNull();
});
```

Run: `npm test -- __tests__/ui/backlog-root.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx`

Expected: PASS. Tests exercise root cards, creation, validation, edits, project move, subtask restriction, completion and both confirmation outcomes.

- [ ] **Step 5: Commit**

```bash
git add src/app src/ui/backlog src/ui/screen-shell.tsx __tests__/ui/backlog-*.test.tsx
git commit -m "feat: build interactive backlog screens"
```

## Task 6: Сквозная проверка, документация и браузерный прототип

**Files:**
- Create: `docs/testing/epic-02-manual-checklist.md`
- Modify: `README.md`
- Modify: tests only where full suite reveals an obsolete Epic 01 fixture

**Consumes:** Complete Epic 02 UI and use cases.

**Produces:** Проверяемый browser prototype, ручной чек-лист и подтверждённое отсутствие регрессий.

- [ ] **Step 1: Написать проверку для неохваченного браузерного пути**

```tsx
test('creates a reminder with only a title from the root add menu', async () => {
  render(<BacklogRootScreen />);
  await userEvent.press(screen.getByLabelText('Добавить элемент'));
  await userEvent.press(screen.getByText('Новое напоминание'));
  await userEvent.type(screen.getByLabelText('Название'), 'Проверить ответ');
  await userEvent.press(screen.getByText('Сохранить'));
  expect(await screen.findByText('Проверить ответ')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Запустить новый тест и подтвердить его зелёный статус**

Run: `npm test -- __tests__/ui/backlog-root.test.tsx`

Expected: PASS; это регрессия завершённого интерактивного сценария.

- [ ] **Step 3: Написать чек-лист и обновить README**

Документировать команды `npm run web` и `npm start`, следующие ручные пути: три карточки в нужном порядке; создание каждого типа только по названию; редактирование; перенос задачи туда и обратно; каскад завершения; отмена и подтверждение удаления; отсутствие поиска и фильтров; перезагрузка web-страницы сбрасывает данные; перезапуск iPhone сохраняет SQLite-изменения.

- [ ] **Step 4: Выполнить полную автоматическую проверку**

Run: `npm test`

Expected: все test suites PASS.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run web:export`

Expected: exit code 0 и маршруты Backlog успешно экспортированы.

- [ ] **Step 5: Запустить browser prototype для финальной проверки**

Run: `npm run web`

Expected: Expo выводит локальный URL; на нём доступны все сценарии Epic 02 без iPhone.

- [ ] **Step 6: Commit и push проверенного результата**

```bash
git add README.md docs/testing/epic-02-manual-checklist.md __tests__
git commit -m "docs: add epic 02 acceptance checklist"
git push origin epic-02-backlog-management
```

## Plan self-review

- Спецификация покрыта: три категории, все четыре создания, редактирование, перенос, ограничение подзадачи, каскадное завершение проекта и задачи, подтверждённое удаление, browser prototype и iPhone SQLite проверка имеют отдельные задания.
- Нет placeholders: все задания содержат конкретные файлы, команды, ожидаемые результаты и сценарии тестов.
- Согласованность типов: Task 1 определяет поля, Task 2 хранит их, Task 3 выполняет сценарии, Task 4 публикует данные, Task 5 отображает интерфейс, Task 6 проверяет путь целиком.
