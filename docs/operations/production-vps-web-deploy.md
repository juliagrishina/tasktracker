# Production-деплой web/PWA на VPS

Эта инструкция публикует статическую web/PWA-сборку ветки `main` на
`https://planmyplan.ru`. Она не относится к EAS staging: команды
`qa:staging:*` для production использовать нельзя.

## Что меняет этот процесс

- Заменяются только статические файлы в `/var/www/tasktracker`.
- Не меняются Nginx, DNS, TLS/SSL, настройки Supabase Dashboard или секреты.
- `.env.local`, пароли, токены и ключи не попадают в Git, консольный вывод или
  переписку с Codex.
- Данные задач, проектов, настроек и outbox находятся в облаке и локальной
  реплике браузера, а не в каталоге `dist`; их не нужно и нельзя очищать для
  обновления сайта.

## Что должно быть настроено один раз

На VPS должен быть checkout репозитория (ниже он обозначается как
`~/tasktracker`) и локальный, игнорируемый Git файл `~/tasktracker/.env.local`.
В нём допустимы только два публичных клиентских параметра:

```text
EXPO_PUBLIC_SUPABASE_URL=https://lskslmsqjrgbbgvzdoqs.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
```

Второе значение берётся в production Supabase Dashboard из Project Settings →
API. Его не нужно пересылать в чат или коммитить. Если файл уже настроен и
production-версия ранее работала, не редактируйте его перед обычным релизом:
следующая команда сама безопасно проверит URL и формат ключа, не печатая
значения.

В production Supabase Dashboard отдельно должны быть выставлены Site URL и
Redirect URLs для `https://planmyplan.ru`. Полный список Auth-предусловий,
включая SMTP и проверку писем, находится в
[`supabase/production-auth-release-checklist.md`](../../supabase/production-auth-release-checklist.md).
Репозиторный `supabase/config.toml` служит договором и не применяет настройки
Dashboard автоматически.

## Текущий релиз

Перед началом убедитесь, что у пользователя есть доступ по SSH к VPS и `sudo`
для `/var/www/tasktracker`. На сервере выполните:

```bash
cd ~/tasktracker
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm run production:export
```

Ожидаемое состояние перед копированием: `git status --short` не выводит
пользовательских изменений, `git pull` получает commit `54ca065` или более
новый commit `main`, а `production:export` завершается успешно.

`npm ci` нужен для текущего первого релиза и повторяется после изменений
`package-lock.json`. Если lockfile не менялся, а `node_modules` на сервере
исправен, его можно пропустить. Не используйте `npm install` для production
release: он может изменить состав зависимостей.

Команда `npm run production:export` последовательно:

1. Проверяет `.env.local`: только два разрешённых публичных параметра и точный
   production Supabase URL.
2. Запускает TypeScript, ESLint и полный Jest.
3. Собирает статический `dist` и PWA service worker.
4. Проверяет, что в `dist` есть `index.html`, `manifest.json`, `sw.js`, JS
   assets и production Supabase URL; source maps и признаки server-секретов
   запрещены.

Если какой-либо этап не прошёл, **не копируйте `dist` в `/var/www/tasktracker`**.
Сохраните только безопасный текст ошибки и передайте его Codex. Не подменяйте
production URL staging URL-ом и не присылайте ключ.

## Резервная копия и публикация

После успешного `production:export` сделайте резервную копию текущей shell.
Это не копия пользовательских данных; она нужна только для быстрого отката
статических файлов.

```bash
sudo install -d -m 755 /var/backups/tasktracker
sudo tar -C /var/www/tasktracker -czf /var/backups/tasktracker/tasktracker-before-release.tgz .
```

Если файл с таким именем уже есть, замените `before-release` на текущую дату и
время, например `2026-09-22-1430`.

Перед удалением файлов проверьте точный target и выполните установленную
замену:

```bash
sudo test "$(readlink -f /var/www/tasktracker)" = /var/www/tasktracker
sudo rm -rf /var/www/tasktracker/*
sudo cp -a dist/. /var/www/tasktracker/
```

Не заменяйте путь на более общий, не удаляйте скрытые server-managed файлы и не
добавляйте флаги к `rm`. Это единственный шаг, который изменяет опубликованный
сайт.

## Проверка сразу после публикации

На VPS выполните:

```bash
curl -fsSI https://planmyplan.ru/
curl -fsSI https://planmyplan.ru/manifest.json
curl -fsSI https://planmyplan.ru/sw.js
```

Все три запроса должны вернуть успешный HTTP-статус. Затем самостоятельно:

1. Откройте сайт в обычном браузере и убедитесь, что появляется экран входа
   или известная рабочая область.
2. Войдите тестовым аккаунтом, если нужна проверка Auth, и убедитесь, что не
   пропали проекты, задачи, завершённые дела и настройки.
3. Для установленной PWA полностью закройте приложение и откройте снова.
   Новая service-worker shell не должна принудительно перезагружать уже
   открытую PWA — это защищает локальную реплику и outbox.

Не удаляйте данные браузера, не переустанавливайте PWA и не отключайте service
worker только для того, чтобы увидеть новую версию.

## Откат

Если HTTP smoke или ручная проверка выявили проблему, не выполняйте новый build
и не очищайте браузерные данные. Восстановите ранее созданный архив:

```bash
sudo test "$(readlink -f /var/www/tasktracker)" = /var/www/tasktracker
sudo rm -rf /var/www/tasktracker/*
sudo tar -C /var/www/tasktracker -xzf /var/backups/tasktracker/tasktracker-before-release.tgz
curl -fsSI https://planmyplan.ru/
```

После отката передайте Codex commit релиза, время, безопасный текст ошибки и
результат `curl`; не присылайте `.env.local`, HTTP authorization headers или
ключи.

## Обычный следующий релиз

Каждая последующая выкладка повторяет этот порядок:

1. Сначала все изменения проходят review, тесты и попадают в GitHub `main`.
2. На VPS: `git pull --ff-only origin main`.
3. Если менялся `package-lock.json` или есть сомнение в зависимостях: `npm ci`.
4. Всегда: `npm run production:export`.
5. Сделайте новый архив текущей shell, замените содержимое web root и выполните
   три `curl` smoke-проверки.
6. Полностью закройте и заново откройте PWA для проверки новой shell.

Не запускайте production deployment автоматически при каждом `git push` и не
используйте staging deployment как замену production-проверке.

## Готовые задания для Codex

### Перед тем как идти на сервер

Отправьте:

> Подготовь production-релиз ветки `main` для `https://planmyplan.ru`, но не
> публикуй его. Проверь, что `main` совпадает с `origin/main`, проверь diff,
> typecheck, lint и полный Jest. Проверь production release contract и сообщи
> commit, результаты и блокеры. Не меняй Nginx, DNS, SSL, Supabase Dashboard,
> `.env.local` или секреты.

### Когда проверки готовы и можно публиковать

Отправьте:

> Подтверждаю production deploy `main` на `https://planmyplan.ru`. На VPS
> выполни `npm run production:export`, только при его успехе сделай backup
> текущего `/var/www/tasktracker`, замени его содержимым `dist` и проверь
> `/`, `/manifest.json` и `/sw.js` через HTTPS. Не меняй Nginx, DNS, SSL,
> Supabase Dashboard, `.env.local` или секреты. При первой ошибке остановись и
> сообщи безопасный текст ошибки.

Эта вторая формулировка является отдельным явным разрешением на изменение
содержимого web root. Без неё Codex ограничивается подготовкой и проверками.

## Частые ситуации

| Симптом | Что делать |
| --- | --- |
| `Invalid EXPO_PUBLIC_SUPABASE_URL` | Остановиться. В VPS `.env.local` указан staging или опечатка; сверить только URL с production contract, не передавая ключ. |
| Jest показывает `Force exiting` после зелёного результата | Это известное предупреждение среды Jest; `production:export` использует `--forceExit` только после выполнения всех тестов. Если есть хотя бы один `FAIL`, релиз не делать. |
| `curl` вернул ошибку | Остановиться, не повторять очистку web root. Восстановить архив и передать Codex status/безопасный вывод. |
| В установленной PWA старая оболочка | Полностью закрыть PWA и открыть вновь. Не удалять данные приложения. |
| Не приходят письма или вход не работает | Статический deploy это не исправляет. Проверить production SMTP/Auth настройки и тестовую доставку по release checklist; секреты в чат не присылать. |
