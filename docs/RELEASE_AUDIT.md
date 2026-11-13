# Release-аудит MFT39

13 ноября 2026. Канонический проект Desktop/TKD-39-REDESIGN; существующий tkd39 и история других проектов не изменены. Подготовлен самостоятельный статический frontend для приватного lenentwin/tkd-site. Cloudflare deployment пока не выполнялся.

## Вывод и исправления

| ID | Уровень до исправления | Доказательство / результат |
| --- | --- | --- |
| R01 | High | src/app/App.tsx и AuthProvider.tsx раньше включали локальный editor/demo-auth в общую сборку. Теперь DEV-only lazy imports; production не содержит editor/demo route chunks, demo-session не принимается. /editor показывает not-found, /login,/account,/booking — not-connected без форм и fake success. |
| R02 | Critical (dev tooling) | npm audit обнаружил vitest/tinypool advisory; Vitest обновлён до5.1.0. Это не эксплуатируемый удалённый production endpoint: тестовый сервер не публиковался. |
| R03 | Moderate (dev tooling) | minimatch10 в typescript-eslint заменён targeted override11.0.1; именованный minimatch API и Node24 совместимы, ESLint/TS/tests прошли. Остальные ветви minimatch3 не заменялись. Полный npm audit:0. |
| R04 | Medium | Production раньше мог читать local CMS snapshot/storage/message. loadContent теперь возвращает defaultContent; storage/postMessage preview не применяются в PROD. Старые пользовательские локальные данные не удалялись. |
| R05 | Medium | Настроен нативный Pages SPA fallback, защитные headers/CSP и закрытие служебных URL от индексирования. CSP допускает inline styles из React/GSAP, но не inline scripts/eval; form-action none, connect-src self, точные frame origins Яндекс/RuTube. |
| R06 | Low | Ошибки AppBoundary больше не выводят stack/message в production console. Аналитика, remote logging, формы/POST/БД отсутствуют. |

## Секреты и Git

Независимый pattern scan дерева не нашёл секретов; проверялись env/key/credential patterns без вывода значений. В начальном локальном Git нет коммитов и объектов: это отсутствие истории, а не её очистка. Поэтому обнаруженных исторических секретов и оснований для ротации нет; скан не является математической гарантией отсутствия любого возможного секрета. .env.example содержит только пустую публичную настройку API. Ignore исключает .env*, ключи, .dev.vars, .wrangler, vendor/build/cache/results, оригинальные Fonts/font.zip и локальные оригиналы ТЗ docs/sources. Веб-woff2 остаются runtime asset. Конкретные данные и ограничение сканирования — RELEASE_AUDIT_INVENTORY.md.

## Очистка

Из публикуемого scripts убраны и сохранены локально в .cache/release-retired-scripts одноразовые capture-nav-views, debug-repeated-anchor, visual-state-check, format-creative-css, reference-browser-research, reference-followup, reference-live-check, research-yandex-embed, а также superseded qa-production и motion-qa. Исторические отчёты ссылаются на них как на прошлые свидетельства, не release gates. Входной граф всех src подтверждён: удалять живые компоненты/4шрифта/favicon/OG нельзя. Удалён неиспользуемый manualReviewsSource из services/demo.ts; тип ReviewsSource сохранён для будущего контракта.

Прямые runtime зависимости не удалялись: gsap/react/react-dom/react-router-dom/zod используются. Обновления dev dependencies и транзитивное удаление19пакетов произведены npm с lockfile. Удалять случайные бинарные материалы пользователя и старые проекты не требовалось.

## Проверки

- Чистый npm ci, ESLint, TypeScript strict и Vite build PASS. Первую блокировку esbuild.exe в Windows устранили остановкой только процессов этого проекта; повторная установка завершилась.
- Vitest:14/14 в3файлах, включая конфигурацию backend и отсутствие сетевой отправки demo booking.
- Полный npm audit и npm audit --omit=dev:0 уязвимостей после исправлений.
- Edge production:30 сочетаний10маршрутов×390/768/1440,0 page errors,0 POST. Точный CSP подставлен в ответы; обе темы и управление Hero прошли. Просмотр production кадров сохранён в test-results/release; браузеры закрыты.
- Проверка dist:нет demo-user/test-child/demo-login/editor chunks и demo-session marker; Нативный SPA fallback и headers настроены. Артефакты не коммитятся.
- Сохранились предупреждения Rollup о двух комментариях Zod; проверки не отключались. Основной JS около499kB/161kB gzip, CSS67kB/14kB gzip.

## Границы готовности

Подготовка к GitHub/Pages не равна подключению backend. Настоящие OAuth/личный кабинет/заявки, БД, production-редактор, серверные cookies/CORS/CSRF не реализованы. Нет D1/Pages Functions и передачи реальных персональных данных в базы/логи. Не тестировались Firefox/Safari/физические телефоны и реальные Pages response headers после deployment. Для полноценной фотогалереи нужны перенесённые из локального браузера материалы и права на них. Точные Pages параметры и будущая безопасная архитектура в DEPLOYMENT.md; прежние prototype-отчёты не заменяют этот release gate.

