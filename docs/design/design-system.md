# Task Tracker — дизайн-система

**Статус:** утверждена 8 августа 2026 года.

## Визуальный источник истины

Экранные решения фиксированы и берутся из HTML-макетов в `docs/interface/mockups/`:

- «План» — вариант **B**, дашборд дня;
- Backlog — вариант **2**, карточки категорий;
- «Завершённые» — вариант **1**, история по датам;
- «Настройки» — вариант **2**, панель состояния.

Текст «рекомендация» внутри исторических файлов сравнения не является новым решением и не отменяет этот выбор. HTML-макеты задают композицию, визуальную иерархию и состояния; их уменьшенные размеры шрифта не копируются буквально в production UI.

## Tokens

`src/ui/design/tokens.ts` — единственный исполнимый источник этих значений. Компоненты не объявляют свои hex-цвета, радиусы, интервалы или elevation, если нужное семантическое значение уже существует в tokens.

### Цвета

| Назначение | Token | Значение |
| --- | --- | --- |
| Основной текст | `color.text.primary` | `#172033` |
| Вторичный текст | `color.text.secondary` | `#727B89` |
| Третичный текст / placeholder | `color.text.tertiary` | `#8A929E` |
| Фон приложения | `color.surface.canvas` | `#F5F7FA` |
| Нейтральная поверхность | `color.surface.base` | `#F7F8FB` |
| Карточка | `color.surface.raised` | `#FFFFFF` |
| Заполненный control | `color.surface.subtle` | `#F0F2F5` |
| Тонкая граница | `color.border.subtle` | `#E5E9EF` |
| Info border | `color.border.info` | `#D8EAFF` |
| Primary | `color.primary` | `#0A84FF` |
| Strong primary text | `color.primaryStrong` | `#0873D6` |
| Мягкая primary surface | `color.primarySoft` | `#EAF4FF` |
| Успешное действие / выполнение | `color.feedback.success` | `#31A866`, `#D9F7E2`, `#176B3A` |
| Предупреждение | `color.feedback.warning` | `#FFF3CF`, `#6F5500`, `#F3DC93` |
| Необратимое действие | `color.feedback.danger.foreground` | `#D83931` |
| Встреча календаря | `color.meeting` | `#E9EEF6`, `#33435B`, `#7A91AF` |

Состояние отменённого элемента использует отдельную нейтральную surface с приглушённым текстом и зачёркиванием. Оно не является error-state. Красная отметка текущего времени (`#FF3B30`) зарезервирована для будущего компонента дашборда дня.

### Типографика

Шрифт: `SF Pro Text` на iOS, системный `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` на web. Используются веса `400`, `600`, `700` и размеры `11`, `12`, `14`, `16`, `18`, `24`, `28` pt/px с системным масштабированием текста.

| Роль | Размер / line-height | Вес |
| --- | --- | --- |
| `display` | 28 / 34 | 700 |
| `screenTitle` | 24 / 29 | 700 |
| `sectionTitle` | 18 / 23 | 700 |
| `body` | 16 / 22 | 400 |
| `bodyStrong` | 16 / 22 | 600 |
| `label` | 14 / 18 | 600 |
| `meta` | 12 / 16 | 400 |
| `micro` | 11 / 14 | 600 |

### Пространство, размеры и форма

- `space`: `2, 4, 6, 8, 10, 12, 16, 20, 24, 32`.
- `radius.compact`: `8`; `radius.control`: `10`; `radius.row`: `12`; `radius.card`: `18`; `radius.sheet`: `20`; `radius.pill`: `999`.
- `size.touchTargetMin`: `44`; `size.floatingAction`: `48`; `size.tabBar`: `60` плюс iOS safe area.
- Граница по умолчанию: `1px color.border.subtle`.
- Elevation карточки: `0 2px 9px rgba(25,37,56,.035)`; floating primary action использует синюю тень из tokens.

Радиус телефонной рамки `38–39` в HTML является только атрибутом preview-страницы и не применяется в приложении.

## Компоненты и состояния

В общий UI-слой входят только повторяющиеся элементы, нужные текущему Task Tracker:

- `SurfaceCard` — обычная или info-карточка; интерактивная карточка имеет semantic role, минимум 44×44 и pressed state.
- `ActionButton` — `primary`, `soft`, `secondary`, `danger`; disabled-состояние задаётся явно.
- `StatusPill` — `neutral`, `info`, `success`, `warning`.
- `ScreenShell` — safe area, заголовок, действие заголовка и scrollable content.
- `BacklogCategoryCard`, `TreeList`, `ItemFormSheet`, `ItemDetailActions` — предметные компоненты Epic 02.

Поддерживаемые состояния: default, pressed, selected/active, completed, cancelled, connected/success, warning, destructive и disabled. Для web обязательны видимый focus и keyboard tab order; hover не заменяет focus. Отдельный visual error-state полей пока не создаётся: в согласованных макетах его нет, а текущая форма отображает текстовую валидацию.

## Платформенные правила

На iOS соблюдаются safe areas, touch targets не менее 44×44, нативный bottom sheet и поведение клавиатуры. На web минимальная ширина не вызывает горизонтальный scroll; keyboard navigation повторяет визуальный порядок; focus остаётся видимым.

## Отложенные предметные компоненты

`DayDashboard`, `CompletedDateGroup`, `SettingsStatePanel`, `SearchField` и карточка статуса Microsoft 365 имеют утверждённый визуальный контракт, но не реализуются в этой поставке. Они потребуют данных и пользовательских сценариев Epic 03–06 и Epic 07–08; при реализации используют эти tokens и primitives, а не собственный набор значений.
