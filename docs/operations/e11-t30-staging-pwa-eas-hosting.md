# E11-T30 — staging PWA на EAS Hosting

Эта инструкция управляет только отдельным staging web/PWA контуром Epic 11. Она
не публикует native build, Expo Update, TestFlight, custom domain или production
среду. До первого deploy URL ещё не существует: ожидаемый формат alias —
`https://plan-my-plan--staging.expo.app`, но считать его созданным можно только
после успешного результата Expo.

## 1. Локальный preflight

В рабочей ветке, содержащей E11-T30, выполнить:

```powershell
npx --yes eas-cli@23.2.0 whoami
npm run qa:staging:export
```

Первая команда должна показать только Expo owner `grishina13`. Вторая должна
пройти guard, typecheck, lint, полный Jest suite и создать `dist` с `sw.js` без
source maps. Не копировать и не показывать значения из `.env.local`.

## 2. Отдельная точка разрешения

До любого действия в Expo/Supabase получить отдельное подтверждение пользователя
на каждый следующий внешний шаг. Локальная подготовка, Git-коммит и успешный
preflight не являются таким разрешением.

## 3. Первый deploy и привязка Expo project

После прямого разрешения на первый deploy выполнить один раз:

```powershell
npx --yes eas-cli@23.2.0 deploy --environment preview --alias staging --dev-domain plan-my-plan --export-dir dist
```

До этой команды выполнить `eas init --account grishina13 --non-interactive` в
том же отдельно одобренном внешнем шаге. Он создаёт или связывает Expo project
владельца `grishina13`; generated `expo.extra.eas.projectId` нужно проверить и
зафиксировать отдельным reviewed Git-коммитом до deploy. После успешной публикации
проверить immutable deployment ID и staging alias ожидаемого формата.

Если Expo сообщает, что `plan-my-plan` недоступен, остановиться. Не выбирать
вариант автоматически, не использовать `planmyplan.ru` и не выполнять второй
deploy. Зафиксировать безопасное сообщение об ошибке и согласовать новый domain
и resulting alias с пользователем.

## 4. Только публичные переменные preview

После отдельного разрешения в Expo Dashboard создать ровно две переменные для
environment `preview`:

1. `EXPO_PUBLIC_SUPABASE_URL` — canonical HTTPS URL staging Supabase;
2. `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — staging publishable key.

Обе имеют публичную browser-видимость. Не добавлять service role, SMTP, Resend,
Trello, Microsoft OAuth credentials, access/refresh token, pepper или иной
secret. Не менять production environment. Локальная сборка по-прежнему проходит
guard из `qa/staging-web-contract.json`; ключ в Git не записывается.

## 5. Redirect URL только для staging Supabase

После отдельного разрешения добавить фактический HTTPS staging alias из шага 3
в Redirect URLs только staging Supabase project. Не добавлять localhost, LAN,
tunnel, custom domain или production URL и не менять Redirect URLs production
Supabase. Сохранить изменение и проверить, что registration/recovery flow
возвращается на staging alias.

## 6. Повторный staging deploy

После нового прямого разрешения на upload и успешного preflight выполнить:

```powershell
npm run qa:staging:deploy
```

Команда публикует уже экспортированный `dist` только в environment `preview` и
двигает alias `staging`; `--prod` отсутствует. Записать immutable deployment ID,
Git commit и alias без токенов/secret query strings. Не включать deploy в hook,
CI или npm lifecycle.

## 7. Откат staging alias

Если staging shell регрессирует, после отдельного разрешения переназначить alias
`staging` на известный хороший immutable deployment через EAS Hosting dashboard
или документированную команду EAS CLI. Сначала сверить deployment ID и commit.
Не удалять IndexedDB, outbox или service worker: rollback меняет только
указатель alias. Затем повторить smoke после полного закрытия и повторного
открытия PWA.

## 8. Ручная PWA-приёмка

Только после появления HTTPS alias пройти
[`Epic 11 e2e checklist`](../testing/epic-11-auth-and-sync-e2e-checklist.md).
Expo Go, LAN URL, ngrok и Cloudflare tunnel не являются доказательством
установленной PWA-приёмки.
