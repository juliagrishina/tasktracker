# E11 T31 staging web PWA desktop report

**Дата:** 2026-09-11

**Контур:** EAS Hosting preview, alias `staging`

**Immutable deployment:** `a0g153ez3k`

**Проверочная ветка:** `codex/epic-11-auth`
**Commit с автоматическими проверками:** `056ad5474d782a99aaef4d6b5221d4f12d802df6`

## Дополнение: 2026-09-12 — исправления регистрации для physical QA

**Immutable deployment:** `tlqb76gz24`
**Staging alias:** `https://plan-my-plan--staging.expo.app`
**Проверочная ветка:** `codex/epic-11-auth`
**Коммиты:** `6af26b4` (iOS-совместимое переключение видимости пароля и
диагностика лимита писем), `33b650a` (безопасная подсказка для повторной
регистрации существующего аккаунта).

Новая публикация прошла `npm run qa:staging:deploy`: QA configuration guard,
typecheck, web/PWA export и финальная проверка `dist` успешны; Jest — **100
suites / 435 tests**; ESLint — 0 errors и 11 ранее известных warnings в
тестовых файлах. HTTPS smoke staging alias вернул 200, PWA manifest доступен.

Для iOS поле пароля теперь пересоздаётся при переключении видимости, сохраняя
controlled value; это устраняет несовместимость runtime-смены
`secureTextEntry` в Safari/PWA. Ошибки отправки OTP не раскрывают технические
детали: 429 сообщает о временном лимите писем, а ответ о ранее созданном
аккаунте предлагает войти, не подтверждая состояние произвольного email.

SMTP staging включён (Resend), а минимальный интервал для одного адреса — 60
секунд. Повторная регистрация не является способом сбросить существующий
серверный аккаунт: после очистки PWA следует использовать «Войти».

## Дополнение: 2026-09-12 — PWA runtime-конфигурация Auth

**Immutable deployment:** `02viz8dyv3`
**Commit:** `e2c60386a9cbc8f7dbe0db88d7e9d7b74c98bdff`

Physical QA выявила, что предыдущий статический web bundle не содержал
публичный staging Supabase origin. Вследствие этого web/PWA создавала
`supabase = null` и не доходила до Auth API при регистрации; это объясняло
отсутствие записи в staging Auth logs и общее сообщение об ошибке отправки.

Исправление передаёт два уже публичных клиентских параметра через Expo runtime
config и использует их, когда `process.env` недоступен в статическом web bundle.
Output guard теперь требует reviewed staging URL в `dist`; проверка не читает и
не выводит publishable key. Новая публикация прошла полный pipeline: 100 suites
/ 437 tests, 0 ESLint errors (11 существующих test-only warnings), web-export и
output guard. Post-deploy HTTPS smoke вернул 200 и подтвердил reviewed origin в
опубликованном JavaScript bundle.

## Итог desktop части

Staging alias открылся по HTTPS и показал только авторизационный экран. На
регистрации есть переключатели показа обоих паролей; на входе есть email,
пароль, переключатель показа пароля, восстановление пароля и переход к
регистрации. Пользовательской кнопки продолжения без аккаунта нет. На ширине
390 px не обнаружено горизонтальной прокрутки, а кнопка входа оставалась
полностью видимой. В console браузера не было warning или error.

Это smoke, а не подтверждение реальной iOS PWA: browser automation не имеет
доступа к состоянию установленной PWA и не создаёт тестовые аккаунты или OTP.

## Повторный автоматический preflight

Команда `npm run qa:staging:export` завершилась успешно.

- QA staging configuration guard: успешно;
- TypeScript typecheck: успешно;
- ESLint: 0 errors, 11 уже известных warnings в тестовых файлах;
- Jest: 100 suites, 431 tests — успешно;
- web static export: успешно;
- финальная проверка `dist`: успешно, сформированы PWA assets, включая
  `manifest.json` и `sw.js`, source maps не экспортированы.

Проверки контрактов подтверждают, что worker precache-ит только статическую
shell и не вводит runtime caching для Supabase, Auth или OTP. Они не заменяют
проверку offline-reopen на физическом устройстве.

## Остаётся за пользователем на физических устройствах

Не пройдены сценарии 1–13 из основного чеклиста, для которых нужны отдельные
тестовые email, реальный iPhone, доступ к почте и для части сценариев второе
устройство. В первую очередь требуются: первый онлайн-вход, установка PWA из
Safari, полное закрытие, запуск в авиарежиме, offline CRUD и проверка outbox
после возврата сети. Подробная последовательность находится в
[`e11-t31-iphone-pwa-instructions.md`](e11-t31-iphone-pwa-instructions.md).

E11-T31 остаётся **в процессе** и блокирует production release до фиксации
результатов всех обязательных сценариев.
