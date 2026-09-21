# QA-публикации для iPhone через Expo Go

Этот процесс предназначен только для ручной проверки веток TaskTracker в Expo Go. Он использует отдельный EAS-проект, канал обновлений `qa` и staging Supabase `zwckrqbdepgvenanyans`. Production-сайт `planmeplan.ru`, production Supabase, production EAS-среда, TestFlight и App Store в этот процесс не входят.

## Что настроено один раз

- EAS-проект TaskTracker связан с репозиторием через `app.json`.
- В `eas.json` есть единственный профиль `qa`, канал `qa` и EAS environment `preview`.
- В EAS environment `preview` разрешены только два project-scoped plaintext-параметра:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Оба значения относятся к staging. Не добавляйте туда service-role, SMTP, CAPTCHA, OTP, ngrok, Edge Function secret или другой параметр. Если remote-проверка найдёт лишний параметр либо URL не staging, она остановит публикацию.

## Подготовка нового worktree

1. Создайте worktree от актуального `main` и установите зависимости.
2. Скопируйте `.env.example` в `.env.local` в этом worktree.
3. Укажите только staging `EXPO_PUBLIC_SUPABASE_URL` и staging `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Выполните:

```bash
npm run qa:verify
```

Команда не печатает значения. Она проверяет точный staging URL, наличие ключа, отсутствие любых других параметров и то, что `.env.local` не отслеживается Git.

## Публикация QA-ревизии

Внимание: не публикуйте без явного запроса пользователя и без прохождения проверок текущей задачи. До публикации выполните relevant target tests и `npm run typecheck`.

После явного согласования:

```bash
npm run qa:publish -- --message "Epic 11: authentication manual acceptance"
```

Скрипт последовательно проверяет локальный `.env.local`, безопасно получает EAS `preview` в временный игнорируемый файл, проверяет его и удаляет. Только затем EAS получает команду `--channel qa --environment preview`. Временный файл удаляется и при ошибке; значения параметров не выводятся.

Откройте QR-код или ссылку из EAS Update в Expo Go на iPhone. Проверьте только сценарии текущей задачи и используйте только тестовые адреса и staging Supabase.

## Если публикация остановлена

Не обходите проверку и не подменяйте параметры вручную в команде. Исправьте только `.env.local` текущего worktree или два разрешённых значения EAS `preview`, затем снова выполните `npm run qa:verify`. Повторная публикация всё равно требует отдельного явного запроса.

Изменение нативных зависимостей, разрешений или Expo SDK не проверяется через Expo Go update. Для таких изменений потребуется отдельное согласование EAS development build.
