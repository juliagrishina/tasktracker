# Approved UI Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зафиксировать утверждённую дизайн-систему и перенести её в общий UI-слой и уже реализованные маршруты Epic 01–02, не добавляя функциональность будущих эпиков.

**Architecture:** `src/ui/design/tokens.ts` будет единственным источником семантических цветов, типографики, размеров, радиусов и elevation. Композиции и сложные платформенные поверхности остаются разделяемыми только при совпадении UX: Expo/React Native-компоненты используют общие tokens, а последующие `.native.tsx` / `.web.tsx` реализации получат один контракт и разные layout/interaction-паттерны.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router 6, React Native Web, TypeScript strict, Jest + jest-expo + React Native Testing Library.

## Global Constraints

- Финальные экранные решения: «План» B (дашборд дня), Backlog 2 (карточки категорий), «Завершённые» 1 (история по датам), «Настройки» 2 (панель состояния).
- В этой поставке изменяется только визуальный UI-слой и его документация. Планирование времени, поиск и фильтры архива, редактирование настроек, Microsoft 365 и Outlook не реализуются до соответствующих эпиков.
- Логика и инварианты Epic 01–02 не меняются: хранение локальное, Backlog без поиска и фильтров, проект завершает свои задачи и подзадачи, задача завершает свои подзадачи.
- Общий визуальный язык обязателен для iOS и web; идентичные технические компоненты не требуются, если это ухудшает UX платформы.
- Все новые поведения создаются по TDD: сначала падающий тест, затем минимальная реализация, затем полный набор проверок.
- Browser prototype обязателен: `npm run web` должен продолжать открывать четыре вкладки с теми же маршрутами и Backlog-сценариями.
- Коммиты создаются от `juliagrishina <juliagrishina@users.noreply.github.com>`; remote URL и настройки SSH не менять.

---

## File structure

| Файл | Ответственность |
| --- | --- |
| `docs/design/design-system.md` | Человеческая документация финальных токенов, состояний и применяемых компонентов. |
| `docs/design/ui-architecture.md` | Границы общего кода и native/web-реализаций, правила адаптации экранов. |
| `src/ui/design/tokens.ts` | Единственный исполнимый источник design tokens для React Native и React Native Web. |
| `src/ui/primitives/surface-card.tsx` | Повторяемая интерактивная или статическая поверхность карточки. |
| `src/ui/primitives/action-button.tsx` | Кнопки `primary`, `soft`, `secondary`, `danger` с доступными состояниями. |
| `src/ui/primitives/status-pill.tsx` | Семантические статусы `neutral`, `info`, `success`, `warning`. |
| `src/ui/screen-shell.tsx` | Safe area, заголовок и фон экрана на базе tokens. |
| `src/app/(tabs)/_layout.tsx` | Токенизированная нижняя навигация четырёх разделов. |
| `src/ui/backlog/category-card.tsx` | Визуальная реализация выбранного Backlog 2 без изменения сценариев. |
| `src/ui/backlog/tree-list.tsx` | Единый список задач и подзадач в визуальном языке макетов. |
| `src/ui/backlog/item-form-sheet.tsx` | Ввод, states, sheet и кнопки с tokens. |
| `src/ui/backlog/item-detail-actions.tsx` | Понятные primary / secondary / destructive действия Backlog. |
| `src/app/(tabs)/backlog/**/*.tsx` | Существующие маршруты Epic 02, использующие общий UI-слой. |
| `__tests__/ui/design-tokens.test.ts` | Контракт главных design tokens. |
| `__tests__/ui/primitives.test.tsx` | Доступные роли и состояния базовых компонентов. |
| `__tests__/ui/screen-shell.test.tsx` | Заголовок, действие и safe-screen contract. |
| `__tests__/ui/backlog-*.test.tsx` | Регрессии интерактивного Backlog после визуальной миграции. |

## Task 1: Зафиксировать дизайн-систему и границы платформ

**Files:**
- Create: `docs/design/design-system.md`
- Create: `docs/design/ui-architecture.md`
- Modify: `docs/interface/README.md`

**Consumes:** Утверждённые HTML previews и [архитектурное решение](../../interface/README.md): B / 2 / 1 / 2.

**Produces:** Два источника проектной истины: описание визуального языка и границы общего/native/web-кода.

- [ ] **Step 1: Создать `design-system.md`**

Записать согласованные semantic tokens: `text.primary #172033`, `text.secondary #727B89`, `surface.canvas #F5F7FA`, `surface.raised #FFFFFF`, `border.subtle #E5E9EF`, `primary #0A84FF`, success/warning/danger/meeting tones. Зафиксировать типографику `11/12/14/16/18/24/28`, spacing `2/4/6/8/10/12/16/20/24/32`, radii `8/10/12/18/20/999` и минимум 44×44 для интерактивных целей.

- [ ] **Step 2: Создать `ui-architecture.md`**

Документировать вариант 2: общие tokens и простые primitives; `*.native.tsx` / `*.web.tsx` только для поведения или layout, различающихся по платформе. Указать, что iOS использует safe areas, bottom tabs, sheets и touch, а web — responsive композицию, hover, focus-visible и tab order. Отдельно указать, что desktop layout ещё не имеет утверждённого экрана и не создаётся этой задачей.

- [ ] **Step 3: Обновить README интерфейса**

Добавить ссылки на новые документы и правило: текстовые блоки «рекомендация» внутри исторических HTML не отменяют выбор B / 2 / 1 / 2.

- [ ] **Step 4: Проверить ссылки и содержание**

Run: `rg -n "План.*B|Backlog.*2|Завершённые.*1|Настройки.*2|#0A84FF" docs/design docs/interface/README.md`

Expected: все четыре выбора и основной brand token найдены; ни один документ не обещает реализацию Microsoft 365, поиска или планирования в этой поставке.

- [ ] **Step 5: Commit**

```powershell
git add docs/design docs/interface/README.md
git commit -m "docs: define approved UI design system"
```

## Task 2: Добавить единый контракт design tokens

**Files:**
- Create: `src/ui/design/tokens.ts`
- Test: `__tests__/ui/design-tokens.test.ts`

**Consumes:** `docs/design/design-system.md`.

**Produces:** `designTokens`, типизированный объект, который импортируют экраны и primitives вместо literal hex/radius/spacing значений.

- [ ] **Step 1: Написать падающий тест token contract**

```tsx
import { designTokens } from '../../src/ui/design/tokens';

test('preserves the approved primary, surface and touch-target tokens', () => {
  expect(designTokens.color.primary).toBe('#0A84FF');
  expect(designTokens.color.surface.canvas).toBe('#F5F7FA');
  expect(designTokens.size.touchTargetMin).toBe(44);
  expect(designTokens.radius.card).toBe(18);
});

test('keeps success, warning, danger and meeting semantic tones distinct', () => {
  expect(designTokens.color.feedback.success.surface).toBe('#D9F7E2');
  expect(designTokens.color.feedback.warning.surface).toBe('#FFF3CF');
  expect(designTokens.color.feedback.danger.foreground).toBe('#D83931');
  expect(designTokens.color.meeting.surface).toBe('#E9EEF6');
});
```

- [ ] **Step 2: Подтвердить ожидаемое падение**

Run: `npm.cmd test -- __tests__/ui/design-tokens.test.ts`

Expected: FAIL, потому что `src/ui/design/tokens.ts` отсутствует.

- [ ] **Step 3: Реализовать минимальный typed source of truth**

```ts
export const designTokens = {
  color: {
    primary: '#0A84FF',
    text: { primary: '#172033', secondary: '#727B89', tertiary: '#8A929E' },
    surface: { canvas: '#F5F7FA', base: '#F7F8FB', raised: '#FFFFFF', subtle: '#F0F2F5' },
    border: { subtle: '#E5E9EF', info: '#D8EAFF' },
    feedback: {
      success: { surface: '#D9F7E2', foreground: '#176B3A' },
      warning: { surface: '#FFF3CF', foreground: '#6F5500', border: '#F3DC93' },
      danger: { foreground: '#D83931' },
    },
    meeting: { surface: '#E9EEF6', foreground: '#33435B', accent: '#7A91AF' },
  },
  size: { touchTargetMin: 44, tabBar: 60, floatingAction: 48 },
  radius: { compact: 8, control: 10, row: 12, card: 18, sheet: 20, pill: 999 },
  space: { 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32 },
  // Typography and elevation use the values approved in Task 1.
} as const;
```

Do not create CSS, a theme provider, or a cross-platform style engine. Tokens are plain immutable TypeScript values and remain importable by both React Native and React Native Web.

- [ ] **Step 4: Проверить token tests**

Run: `npm.cmd test -- __tests__/ui/design-tokens.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/design/tokens.ts __tests__/ui/design-tokens.test.ts
git commit -m "feat: add shared design tokens"
```

## Task 3: Реализовать только нужные базовые UI-primitives

**Files:**
- Create: `src/ui/primitives/surface-card.tsx`
- Create: `src/ui/primitives/action-button.tsx`
- Create: `src/ui/primitives/status-pill.tsx`
- Test: `__tests__/ui/primitives.test.tsx`

**Consumes:** `designTokens` from Task 2.

**Produces:** Малый набор компонентов, реально используемый Backlog screens и последующими согласованными экранами: `SurfaceCard`, `ActionButton`, `StatusPill`.

- [ ] **Step 1: Написать падающие tests для доступных действий**

```tsx
test('exposes an interactive surface card as a labelled button', () => {
  const onPress = jest.fn();
  const view = render(
    <SurfaceCard accessibilityLabel="Напоминания" onPress={onPress}>
      <Text>Содержимое</Text>
    </SurfaceCard>,
  );

  fireEvent.press(view.getByRole('button', { name: 'Напоминания' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('marks a disabled destructive action as disabled', () => {
  const view = render(<ActionButton disabled tone="danger" label="Удалить" onPress={jest.fn()} />);
  expect(view.getByRole('button', { name: 'Удалить' }).props.accessibilityState.disabled).toBe(true);
});
```

- [ ] **Step 2: Подтвердить ожидаемое падение**

Run: `npm.cmd test -- __tests__/ui/primitives.test.tsx`

Expected: FAIL, потому что primitives ещё не существуют.

- [ ] **Step 3: Реализовать primitives без преждевременной абстракции**

`SurfaceCard` принимает `{ children, onPress?, accessibilityLabel?, tone?: 'default' | 'info', style? }`: без `onPress` возвращает `View`; с `onPress` — `Pressable` с role `button`, minimum touch target, pressed opacity и visible web focus style через platform adapter позже. `ActionButton` принимает `{ label, onPress, tone: 'primary' | 'soft' | 'secondary' | 'danger', disabled? }`, устанавливает `accessibilityState`, использует tokens, но не содержит бизнес-логики. `StatusPill` принимает `{ label, tone: 'neutral' | 'info' | 'success' | 'warning' }`.

- [ ] **Step 4: Проверить primitives**

Run: `npm.cmd test -- __tests__/ui/primitives.test.tsx`

Expected: PASS; tests подтверждают semantic roles, press и disabled state.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/primitives __tests__/ui/primitives.test.tsx
git commit -m "feat: add reusable task tracker UI primitives"
```

## Task 4: Мигрировать каркас приложения на tokens

**Files:**
- Modify: `src/ui/screen-shell.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Modify: `src/ui/empty-plan-state.tsx`
- Modify: `src/ui/task-preview-list.tsx`
- Test: `__tests__/ui/screen-shell.test.tsx`
- Modify: `__tests__/ui/empty-plan-state.test.tsx`
- Modify: `__tests__/ui/tab-definitions.test.ts`

**Consumes:** Tokens and primitives from Tasks 2–3.

**Produces:** Четыре постоянные вкладки и текущие neutral states используют утверждённые цвета, system typography, safe area и доступные touch targets.

- [ ] **Step 1: Написать падающие test для ScreenShell**

```tsx
test('renders a Russian screen title and a labelled header action', () => {
  const view = render(
    <ScreenShell
      title="Backlog"
      headerAction={<ActionButton label="Добавить" tone="soft" onPress={jest.fn()} />}>
      <Text>Контент</Text>
    </ScreenShell>,
  );

  expect(view.getByText('Backlog')).toBeOnTheScreen();
  expect(view.getByRole('button', { name: 'Добавить' })).toBeOnTheScreen();
});
```

- [ ] **Step 2: Подтвердить ожидаемое падение**

Run: `npm.cmd test -- __tests__/ui/screen-shell.test.tsx`

Expected: FAIL, пока отсутствует тестируемый tokenized contract либо action не получает корректную semantic role.

- [ ] **Step 3: Применить tokens в shell и навигации**

`ScreenShell` сохраняет public props `title`, `children`, `headerAction`, `onBack`, но заменяет hard-coded indigo/gray/spacing на `designTokens`. Background — `surface.canvas`; title — `text.primary`; back action получает минимум 44×44. В `src/app/(tabs)/_layout.tsx` задать primary `#0A84FF`, inactive `#737B86`, subtle border и высоту tab bar `60`, не меняя titles, routes или Expo Router structure. `EmptyPlanState` и `TaskPreviewList` используют `SurfaceCard`, `text.*`, `space.*`, `radius.*`; тексты не меняются.

- [ ] **Step 4: Проверить shell и существующие screen fixtures**

Run: `npm.cmd test -- __tests__/ui/screen-shell.test.tsx __tests__/ui/empty-plan-state.test.tsx __tests__/ui/tab-definitions.test.ts`

Expected: PASS; четыре labels вкладок сохраняются в утверждённом порядке.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/screen-shell.tsx src/ui/empty-plan-state.tsx src/ui/task-preview-list.tsx src/app/(tabs)/_layout.tsx __tests__/ui
git commit -m "feat: apply approved design system to app shell"
```

## Task 5: Мигрировать выбранный Backlog 2 без изменения сценариев Epic 02

**Files:**
- Modify: `src/ui/backlog/backlog-root-screen.tsx`
- Modify: `src/ui/backlog/category-card.tsx`
- Modify: `src/ui/backlog/tree-list.tsx`
- Modify: `src/ui/backlog/item-form-sheet.tsx`
- Modify: `src/ui/backlog/item-detail-actions.tsx`
- Modify: `src/app/(tabs)/backlog/reminders.tsx`
- Modify: `src/app/(tabs)/backlog/unassigned.tsx`
- Modify: `src/app/(tabs)/backlog/projects.tsx`
- Modify: `src/app/(tabs)/backlog/project/[id].tsx`
- Modify: `src/app/(tabs)/backlog/item/[id].tsx`
- Test: `__tests__/ui/backlog-root.test.tsx`
- Modify: `__tests__/ui/backlog-form.test.tsx`, `__tests__/ui/backlog-actions.test.tsx`

**Consumes:** Existing `BacklogView`, backlog actions and shared primitives.

**Produces:** Существующий функциональный Epic 02, визуально соответствующий выбранным карточкам-категориям: три category cards с glyph, количеством, двумя preview rows и явным переходом.

- [ ] **Step 1: Написать падающие UI tests новой семантики карточки**

```tsx
test('shows category cards with counts and an explicit open action', async () => {
  const view = await renderBacklogRootWithSeed();

  await waitFor(() => expect(view.getByLabelText('Напоминания')).toBeOnTheScreen());
  expect(view.getByText('Открыть раздел')).toBeOnTheScreen();
  expect(view.getAllByText(/Напоминания|Без проекта|Проекты/)).toHaveLength(expect.any(Number));
});
```

The test must also retain the existing assertions: exactly three categories in fixed order, no search input and creation from `+` still works.

- [ ] **Step 2: Подтвердить ожидаемое падение**

Run: `npm.cmd test -- __tests__/ui/backlog-root.test.tsx`

Expected: FAIL, поскольку text `Открыть раздел` and the approved category-card composition ещё не существуют.

- [ ] **Step 3: Реализовать visual migration root и списков**

Keep `BacklogRootScreen` data flow unchanged. Pass each category an explicit visual kind (`reminders`, `unassigned`, `projects`) so `CategoryCard` renders its existing semantic icon background, count badge, a maximum of two preview rows and `Открыть раздел` (for projects: `Перейти к проектам`). Use `SurfaceCard`, `StatusPill` where a count is a status, and `designTokens`; no hard-coded `#4F46E5` or `#EEF2FF` may remain in Backlog UI. Preserve accessible labels and the 48px floating `+` action.

Migrate `TreeList`, reminder/project route rows, detail information surface, `ItemDetailActions` and `ItemFormSheet` to the same tokens. The form must retain all current labels, validation, keyboard type, Modal behaviour and destructive confirmation. It must not add a schedule picker, Backlog search/filter or any Microsoft 365 control.

- [ ] **Step 4: Проверить все интерактивные Backlog сценарии**

Run: `npm.cmd test -- __tests__/ui/backlog-root.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx`

Expected: PASS. Existing tests prove create/edit/complete/delete behaviour still uses the established domain rules; the root test proves category order and absence of search/filter.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/backlog src/app/(tabs)/backlog __tests__/ui/backlog-root.test.tsx __tests__/ui/backlog-form.test.tsx __tests__/ui/backlog-actions.test.tsx
git commit -m "feat: align backlog with approved category design"
```

## Task 6: Проверить browser prototype и document deferred screens

**Files:**
- Create: `docs/testing/ui-foundations-manual-checklist.md`
- Modify: `docs/design/design-system.md`
- Modify: `README.md` only if its browser-start command is absent or incorrect.

**Consumes:** Tasks 1–5.

**Produces:** Проверяемая передача UI foundation: отображается в browser prototype и не имитирует функциональность будущих эпиков.

- [ ] **Step 1: Создать manual checklist**

Зафиксировать: открыть `npm run web`; проверить четыре таба, primary blue active tab, safe visual whitespace, Backlog cards в порядке «Напоминания → Без проекта → Проекты», две preview rows максимум, `+`, создание/редактирование/завершение/удаление. Для iPhone: 44×44 touch targets, safe area, Bottom Sheet и клавиатура. Для web: tab order, visible focus, no horizontal scroll at 320/375/414/768/1024/1440 widths.

- [ ] **Step 2: Явно описать границы следующих эпиков**

Дополнить `design-system.md`: компоненты `DayDashboard`, `CompletedDateGroup`, `SettingsStatePanel`, `SearchField` и Microsoft 365 status card остаются специфицированными, но не входят в эту реализацию, поскольку требуют данных и сценариев Epic 03–06/07–08. Их дизайн повторно использует уже добавленные tokens/primitives.

- [ ] **Step 3: Выполнить полную автоматическую проверку**

Run: `npm.cmd test`

Expected: 18 или больше suites PASS; existing React `act(...)` console warnings должны быть отмечены как baseline issue, если всё ещё присутствуют, но не должны быть новыми failures.

Run: `npm.cmd run typecheck`

Expected: exit code 0.

Run: `npm.cmd run lint`

Expected: exit code 0.

Run: `npm.cmd run web:export`

Expected: exit code 0, browser bundle generated.

- [ ] **Step 4: Запустить browser prototype**

Run: `npm.cmd run web`

Expected: Expo prints a local URL. Open it in a browser, manually follow the checklist and retain the URL for the user.

- [ ] **Step 5: Commit**

```powershell
git add docs/testing/ui-foundations-manual-checklist.md docs/design/design-system.md README.md
git commit -m "docs: add UI foundation acceptance checklist"
```

## Plan self-review

- Покрытие: tokens, platform boundaries, shared UI, app shell, выбранная реализация Backlog 2, browser prototype и отказ от имитации будущей функциональности имеют отдельные tasks.
- Сохранение требований: tasks не меняют use cases, SQLite contracts, completion cascade, no-search Backlog и four-tab navigation.
- Границы: полная реализация План B, Завершённые 1 и Настройки 2 запланирована только с их data/behaviour epics. Это исключает ложные интерактивные элементы и не создаёт технический долг.
- Контракты: tokens создаются до primitives; primitives — до shell и Backlog; документация и визуальная manual acceptance завершают работу.
