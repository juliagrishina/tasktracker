# E11-T30 — Staging PWA on EAS Hosting Design

## Цель

Дать Epic 11 отдельный постоянный HTTPS URL для staging web/PWA, независимый от
локального компьютера, Expo Go, LAN, ngrok и VPN. URL открывает Auth screen
только с публичной конфигурацией staging Supabase и позволяет выполнить ручную
приёмку T31 на desktop browser и установленной iPhone PWA.

## Контекст и границы

E11-T28 хранит business replica в IndexedDB, а E11-T29 создаёт service worker,
который precache-ит только статическую shell. T30 не меняет Auth state machine,
sync engine, IndexedDB, service worker strategy, native build, EAS Update,
TestFlight, production Supabase или production deploy.

EAS Hosting на Free plan поддерживает immutable web deployments и стабильные
aliases. Для бесплатного контура используется встроенная environment `preview`,
потому что custom environment `staging` требует другой тариф. Alias называется
`staging`; он не является production alias и не использует `--prod`.

## Выбранное решение

### EAS Hosting identity

В репозитории появляется минимальный `eas.json`, который фиксирует поддерживаемую
версию EAS CLI. Когда пользователь отдельно разрешит внешнее действие, первый
deploy связывает Expo project с владельцем `grishina13` и записывает generated
project ID в `app.json` (`expo.extra.eas.projectId`).

Первый deploy запрашивает preview domain `plan-my-plan`. При успехе постоянный
staging alias имеет вид:

`https://plan-my-plan--staging.expo.app`

Если Expo отклонит domain как занятый, deploy останавливается без подбора
альтернативы. Новый preview domain и resulting HTTPS alias сначала согласуются с
пользователем. EAS custom domain, `planmyplan.ru`, `--prod` и production URL не
используются.

### Public staging configuration contract

В `qa/staging-web-contract.json` хранится только canonical HTTPS origin staging
Supabase. Это публичная информация: origin уже должен быть виден в web bundle.
Publishable key не хранится в Git, хотя может присутствовать в браузерном bundle
как публичный Supabase credential.

Перед export guard читает локальный `.env.local` без печати его значений и
проверяет:

1. В нём присутствуют `EXPO_PUBLIC_SUPABASE_URL` и
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. URL является HTTPS URL и в точности совпадает с origin в committed contract.
3. Key имеет publishable формат и не является service-role, legacy anon secret
   или произвольным server credential.
4. В файле нет известных server-only credential names: Supabase service role,
   SMTP, Resend, Trello, Microsoft OAuth, `ACCOUNT_ACTION_TICKET_PEPPER` и
   private-key names.

Guard не считает URL «staging» по эвристике: его staging принадлежность задаётся
явным reviewed contract. Изменение origin требует отдельного изменения контракта
в Git и новой проверки.

### Commands and build inspection

`qa:verify` становится локальной проверкой QA-конфигурации и регрессий. Он
выполняет guard, typecheck, lint и полный Jest suite. `qa:staging:export`
выполняет `qa:verify`, статический web export из T29 и вторую фазу guard —
проверку output `dist`.

Проверка `dist` требует `sw.js`, `manifest.json` и статические HTML/JS assets,
не выводя содержимое bundle или environment values. Она отклоняет source maps и
credential-shaped server secrets; одиночная строка-префикс из публичной SDK сама
по себе не считается credential. Она не пытается кэшировать API responses и не
меняет generated service worker.

Первый deploy остаётся отдельной явной внешней командой: он дополнительно
запрашивает `--dev-domain plan-my-plan`. После него `qa:staging:deploy` служит
только для повторных staging deploy и вызывает pinned EAS CLI с
`--environment preview`, `--alias staging` и `--export-dir dist`.
Ни одна из команд не запускается автоматически из npm lifecycle, git hook или
CI.

### External staging setup

Следующие действия находятся вне Git и требуют отдельного явного разрешения
пользователя непосредственно перед выполнением:

1. Link/create Expo project in account `grishina13` and perform first Hosting
   deployment.
2. Create exactly two EAS `preview` variables: public staging Supabase URL and
   publishable key. Не добавлять EAS secrets, SMTP, tokens или service role.
3. Add the resulting exact HTTPS staging alias to Redirect URLs только в staging
   Supabase project. Production Supabase Redirect URLs не менять.
4. Run browser/iPhone PWA smoke on the deployed alias.

Deployment не требует Apple Developer Program или TestFlight. EAS Hosting
публикует статический web output; iPhone использует Safari «На экран Домой».

## File boundaries

- `eas.json` — EAS CLI compatibility only; no native build or production
  deployment profile.
- `app.json` — Expo owner and generated project ID after explicitly approved
  linking; existing `web.output: static` remains unchanged.
- `qa/staging-web-contract.json` — public canonical staging Supabase origin and
  permitted public variable names; no key or secret.
- `scripts/verify-qa-staging-config.cjs` — parses env/config and inspects dist
  without writing `.env` or logging values.
- `__tests__/qa-staging-deploy-guard.test.ts` — unit tests for accepted and
  rejected configuration/output cases.
- `__tests__/eas-hosting-config.test.ts` — configuration and npm-script contract.
- `docs/operations/e11-t30-staging-pwa-eas-hosting.md` — safe manual setup,
  deploy and rollback instructions.
- `docs/testing/epic-11-auth-and-sync-e2e-checklist.md` — reference the stable
  staging URL and installed-PWA preconditions for T31.

## Security and update behaviour

Only public staging URL and publishable key may enter `dist`. The worker and
precache manifest continue to contain only static asset URLs and revisions; no
Supabase/Auth/OTP responses, session/access/refresh tokens, service role, SMTP,
Resend, Trello or Microsoft credentials may be exported.

T29 settings remain authoritative: no runtime caching, no navigation fallback,
`skipWaiting: false`, `clientsClaim: false`, and registration with
`updateViaCache: 'none'`. Every EAS deployment is immutable. Reassigning the
`staging` alias never forces an already open PWA to reload; the new shell is
accepted only after full close and reopen.

## Acceptance and rollback

Automated acceptance covers the configuration contract, guard acceptance and
rejection cases, static export inspection, `qa:verify`, typecheck, lint and the
full Jest suite. Manual acceptance after deploy covers Auth screen against
staging, install on iPhone, online login, offline reopen, local create/edit,
outbox persistence, reconnect and safe shell update as listed in T31.

To roll back a bad staging shell, assign alias `staging` to a known good immutable
deployment. Do not use production promotion, delete IndexedDB data or unregister
the worker as part of rollback. If the worker itself must be removed in a future
task, ship an explicit cleanup worker that removes only PWA shell caches and does
not access business data.

## Non-goals

- No automatic deployment on push, pull request or merge.
- No GitHub Actions, EAS Workflows, CI secret store or deployment credential.
- No custom domain, paid EAS feature, production deploy or production Supabase
  change.
- No local `.env` overwrite or committed `.env`/session/token.
- No TestFlight, Apple Developer Program, native EAS Build or Expo Update.
