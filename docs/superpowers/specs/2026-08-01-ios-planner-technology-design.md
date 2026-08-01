# Технологическое решение MVP iOS-планировщика

Дата: 1 августа 2026 г.
Статус: стек согласован; документ ожидает финального просмотра перед планированием реализации.

## 1. Решение

Для MVP используется **React Native + Expo + TypeScript**.

Приложение остаётся ориентированным только на iPhone и iOS. React Native выбран не ради кроссплатформенности, а потому, что его можно разрабатывать на Windows и собирать для iPhone в облаке через EAS Build. Интерфейс сохраняет согласованную iOS-визуальную лексику и не пытается имитировать Android.

Применяются следующие части стека:

- Expo с Continuous Native Generation и TypeScript в строгом режиме;
- Expo Router для навигации между четырьмя вкладками и вложенными экранами;
- `expo-sqlite` для локального, офлайн-first хранения данных;
- репозитории и use cases между UI и SQLite, чтобы правила планирования не зависели от экранов;
- `expo-notifications` для локальных уведомлений;
- `expo-secure-store` для токенов Microsoft;
- Microsoft Graph REST API только с делегированными правами `User.Read` и `Calendars.Read`;
- OAuth 2.0 Authorization Code с PKCE через системный браузер для входа Microsoft 365;
- EAS Build и собственный development build для тестирования на iPhone и последующей TestFlight-сборки.

Сервер, пользовательские аккаунты, iCloud и запись в Outlook в MVP не добавляются.

## 2. Microsoft 365: обязательный технический прототип

Исходное ТЗ предусматривает MSAL для нативного SwiftUI-приложения. Для React Native нет поддерживаемого Microsoft официального пакета MSAL; поэтому нельзя закладываться на устаревшую стороннюю обёртку как на фундамент продукта.

Вместо этого первым этапом реализации будет технический прототип на Expo: вход через системный браузер, Authorization Code с PKCE, обработка redirect URI, безопасное хранение токена и чтение `calendarView` Microsoft Graph. Токены не попадают в SQLite, журналы или Git. Запрашиваются только `openid`, `profile`, `offline_access`, `User.Read` и `Calendars.Read`; последние два — единственные права Microsoft Graph.

Критерий перехода к остальному MVP: на реальной корпоративной учётной записи iPhone-приложение выполняет интерактивный и повторный вход, читает события основного календаря и корректно обрабатывает ошибку политики tenant. Если корпоративная политика требует именно брокер MSAL или Intune, это фиксируется как блокер и согласуется отдельно; объём MVP самовольно не расширяется.

## 3. Работа на Windows и Apple Developer Program

| Этап | Можно без Apple Developer Program | Ограничение |
|---|---|---|
| Макеты, экраны, навигация и простые локальные сценарии | Да, через бесплатное Expo Go на iPhone | Expo Go — учебная оболочка с фиксированным набором нативных возможностей; это не среда для релизной проверки. |
| Полноценный технический прототип Microsoft 365, собственные URL-схемы, итоговые уведомления | Нет при разработке только на Windows | Нужна собственная development build, собранная EAS для iPhone. |
| Установка тестовых сборок, TestFlight и App Store | Нет | Нужна платная программа Apple Developer Program. |

Единственный официальный путь установить собственную development build на iPhone без платного аккаунта Apple — собрать её локально через Xcode на macOS с бесплатной учётной записью. Он не подходит для Windows-only процесса и не заменяет TestFlight или выпуск приложения.

Следовательно, Expo Go — полезная временная альтернатива только до начала функциональной разработки. Поскольку ТЗ требует сначала снять риск Microsoft 365, подписку Apple Developer Program следует оформить непосредственно перед этапом технического прототипа, а не после разработки остального приложения. Стоимость программы — 99 USD в год; она также даёт доступ к TestFlight и необходимым профилям подписи.

## 4. Обновление дизайн-спецификации

Функциональные требования и выбранная структура экранов остаются без изменений. В документе дизайна термины `SwiftUI` и `SwiftData` заменяются на платформенно нейтральные: React Native UI и локальное SQLite-хранилище. Это изменение технологии, а не расширение MVP.

## 5. Проверка перед стартом разработки

Перед созданием прикладного кода нужно подтвердить:

1. Apple Developer Program оформлена или выделен временный Mac для локальной iOS-сборки.
2. Есть корпоративная тестовая учётная запись Microsoft 365 и разрешение использовать `Calendars.Read`.
3. В Microsoft Entra ID зарегистрировано mobile/desktop public client-приложение с постоянным bundle ID и корректным redirect URI.
4. Первый development build устанавливается на реальный iPhone.
5. Авторизация и загрузка встреч из `calendarView` проходят до реализации Backlog и Планировщика.

## 6. Источники

- [Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo: ограничения Expo Go](https://docs.expo.dev/develop/development-builds/faq/)
- [Expo: внутренняя iOS-дистрибуция](https://docs.expo.dev/build/internal-distribution/)
- [Microsoft: настройка мобильного приложения](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-mobile-app-configuration)
- [Microsoft: OAuth 2.0 Authorization Code + PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Apple: членство в программе разработчиков](https://developer.apple.com/programs/enroll/)
