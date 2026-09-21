# Постоянный QA контур Expo EAS Update

## Назначение

Создать один постоянный QA контур TaskTracker для ручной проверки текущих веток на iPhone через Expo Go. Контур заменяет локальный Expo tunnel, поэтому не зависит от LAN, Windows Firewall, VPN или ngrok.

## Границы

- QA контур использует отдельный Expo EAS project и отдельный канал обновлений `qa`.
- Каждая публикация собирается только из активного worktree и получает отдельную ревизию QA канала.
- В QA bundle попадают только `EXPO_PUBLIC_SUPABASE_URL` и `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` staging Supabase. Это публичные клиентские параметры; service-role, SMTP, OTP, ngrok и Edge secrets не попадают в bundle, Git или EAS environment.
- Production `planmeplan.ru`, production Supabase, production Expo release и их настройки не меняются.
- QA не является production delivery channel и не создаёт App Store или TestFlight сборку.

## Архитектура

В репозитории хранится общая EAS-конфигурация и app-конфигурация с постоянным идентификатором TaskTracker QA project, который будет создан при первичном подключении. Профиль `qa` публикует JavaScript update в канал `qa`; Expo Go открывает конкретную QA ревизию по ссылке или QR-коду Expo.

Локальный `.env.local` остаётся игнорируемым Git файлом в каждом worktree. Он содержит staging URL и staging publishable key. Перед публикацией команда проверки подтверждает, что URL указывает на staging Supabase, а production URL отклоняется.

## Эксплуатационный поток

1. Один раз: войти в Expo, создать и связать TaskTracker QA EAS project, затем зафиксировать его идентификатор в репозитории.
2. В новом worktree создать `.env.local` из `.env.example` и заполнить только публичные staging параметры.
3. Запустить безопасную проверку среды: staging URL, непустой publishable key и игнорирование `.env.local` Git.
4. Опубликовать QA update из текущего worktree в канал `qa` с сообщением, содержащим Epic, Task или commit.
5. Открыть опубликованную ревизию в Expo Go на iPhone и пройти соответствующий ручной чеклист.
6. QA update не сливается в production. Следующая ветка публикует новую ревизию того же QA канала.

## Ошибки и защита

- Если Expo CLI не авторизован, создание проекта и публикация не выполняются; пользователь проходит вход в браузере самостоятельно.
- Если staging переменные отсутствуют или URL не соответствует staging project, публикация блокируется до исправления локальной среды.
- Expo Go совместим только с библиотеками текущего Expo SDK. Если проекту понадобится нативный модуль, которого нет в Expo Go, QA контур переключается на EAS development build; это отдельное согласование и может потребовать Apple Developer Program.
- Публикация QA bundle внешнему Expo сервису является осознанной доставкой тестового кода. Она выполняется только после явного запроса пользователя на публикацию.

## Критерии готовности

- EAS project создан и связан один раз для всего репозитория.
- `eas.json` содержит только QA profile и канал `qa` для этой цели.
- Конфигурация не содержит секретов и не меняет production delivery.
- Из нового worktree можно подготовить игнорируемый `.env.local`, проверить staging target и опубликовать новую QA ревизию без ngrok.
- На iPhone в Expo Go открывается QA ревизия с staging Supabase конфигурацией.
