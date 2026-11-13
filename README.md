# MFT39

Сайт клуба тхэквондо МФТ в Калининграде: React 19, TypeScript strict, Vite, GSAP. Российский backend: PHP 8.3, PDO MySQL, Яндекс OAuth, серверные сессии, ученики, заявки и ручные месячные отметки оплаты. Сайт mft39.ru публикуется из dist через GitHub Pages; PHP и MySQL размещаются отдельно на api.mft39.ru (Cludex/ISPmanager).

## Локальный запуск

Node.js 24 (см. .node-version):

```sh
npm ci
npm run dev
```

Адрес http://127.0.0.1:5173. DEV-редактор /editor и демонстрационный вход не являются настоящей авторизацией и исключены из production. CMS-снимки хранятся только локально; одобренный контент для публикации переносится в src/content/site.content.ts и public/images. Шрифты Bebas Neue Pro сохранены; права на веб-использование подтверждает владелец. Векторные изображения Hero не выдаются за фотографии воспитанников.

## Проверки

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

Сборка dist, preview http://127.0.0.1:4173. Для production-проверки реального кабинета задайте VITE_AUTH_ENABLED=true и VITE_API_BASE_URL=https://api.mft39.ru **до сборки**. Фиктивные браузерные профили в scripts/qa-account.mjs и scripts/qa-club.mjs применяются только к локальной сборке. Они не заменяют интеграционные MySQL-тесты или живой OAuth.

PHP-проверки: `php backend/tests/run.php`, `php backend/tests/club-rules.php`. Реальная тестовая MySQL 8.4, конкурентные транзакции и HTTP entrypoints проверяются workflow backend.yml в отдельной mft39_auth_test с синтетическими данными. Никогда не запускайте backend/tests/ против действующей базы.

## Кабинет и система секции

/account и все подразделы требуют проверенной серверной сессии. /login использует Яндекс ID; /booking перенаправляет в кабинет или на вход. /editor в production недоступен. Служебные страницы noindex,nofollow; публичные страницы и существующие анимации/темы сохранены.

/account/book: несколько учеников, ФИО, возраст, зал, желаемая дата, необязательный комментарий и представитель для несовершеннолетних. Реальный POST идёт исключительно на российский API; сохранение подтверждается только проверенным ответом. Idempotency key и транзакция защищают повторы. Перед отправкой требуется явное согласие; сервер проверяет его версию и сохраняет факт подтверждения. Черновики и ключи доступа не сохраняются в Storage/IndexedDB/URL. /account/bookings показывает собственные заявки, учеников и историю.

/account/trainer: заявки назначенных залов, принять/отклонить, зачисленные ученики, trial/permanent/inactive, месячная оплата и история. head_trainer/admin видят все залы. Права и версии проверяются на сервере, а не только скрытием кнопок. /account/devices создаёт личный отзываемый 8-часовой доступ для будущего подключения Android. Исходников Android здесь нет; APK не интегрирован.

Новый календарный месяц считается unpaid в Europe/Kaliningrad без CRON и перезаписи прошлых месяцев. Исправления аудируются; устаревшая версия или старый текущий месяц дают409 без скрытого перезаписывания. Банковские платежи не реализуются.

**Установка системы на действующий backend ещё требуется:** frontend разрешает отправку только после успешного bootstrap схемы 2. Пока файлы PHP и миграция 002 не установлены на Cludex, отображается отсутствие сервиса и отправка отключена. Код в GitHub сам по себе не меняет действующую базу.

Документация:

- [API учеников/заявок/оплат](backend/docs/CLUB_API.md).
- [Установка обновления на существующую базу](backend/docs/DEPLOYMENT_CLUB_RU.md).
- [Контракт интеграции Android](backend/docs/ANDROID_CLUB.md).
- [Автоматические проверки PHP/MySQL](https://github.com/lenentwin/tkd-site/actions/workflows/backend.yml).
- [Исходная настройка OAuth](backend/docs/DEPLOYMENT_RU.md) и [контракт авторизации](backend/docs/API.md).

## GitHub Pages: mft39.ru

main → .github/workflows/deploy.yml → Node24, npm ci, lint/test/build → prepare-pages → upload-pages-artifact/deploy-pages. Публикуется только dist, не исходный index.html с /src/main.tsx и не backend/. Settings → Pages → Source: GitHub Actions; Custom domain mft39.ru. CNAME и Vite base=/ сохранены. Секреты PHP в Actions не нужны.

Repository Variables:

| Variable | Значение |
|---|---|
| VITE_AUTH_ENABLED | true |
| VITE_API_BASE_URL | https://api.mft39.ru |

prepare-pages.mjs копирует CNAME и создаёт dist/404.html из index.html. Router получает исходный внутренний путь, query и hash. GitHub Pages отвечает HTTP404 для отсутствующего статического пути, но SPA загружается; подробности в docs/GITHUB_PAGES.md. _headers/_redirects применяются только на Cloudflare, не GitHub Pages.

## Cloudflare Pages, альтернативный frontend

Git integration, Vite preset, branch main, root / (пустое поле), build `npm run build`, output `dist`. NODE_VERSION=24; VITE_AUTH_ENABLED=true; VITE_API_BASE_URL=https://api.mft39.ru. Для Cloudflare НЕ запускать prepare-pages.mjs: используется нативный SPA fallback без верхнего 404.html. public/_headers задаёт CSP и cache; public/_redirects поясняет fallback. Деплой Cloudflare автоматически не запускается. D1, Functions, Workers и внешние БД не подключаются. Backend остаётся в России, DNS/авторизация не меняются.

## Секреты и данные

.env.example содержит только публичные VITE-параметры. Yandex Client Secret, пароль MySQL, RATE_LIMIT_KEY хранятся исключительно в приватном config.local.php или окружении PHP на российском сервере. config.local.php и его копии, .env, архивы/кэш/дампы исключены из Git. Не загружать их даже в приватный репозиторий. Не включать в логи Cookie, Authorization, OAuth query, тела заявок или персональные данные. Нет внешней аналитики/обработчика ошибок с ПД. Серверные SQL-миграции, секреты и роль/grant CLI никогда не должны быть доступны по HTTP. Настоящий OAuth и окончательная приёмка обновления на хостинге остаются проверкой владельца.

В репозитории находятся исходники, воспроизводимая сборка, автоматические тесты и необходимые инструкции. Внутренние ТЗ, отчёты агентов, старые QA-материалы, архивы и локальная конфигурация не публикуются. Лицензии проекта и шрифтов не подменяются выдуманной open-source лицензией.
