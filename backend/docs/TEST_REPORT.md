# Проверки backend авторизации

13 ноября 2026. Проверялся код ветки codex/yandex-auth репозитория lenentwin/tkd-site. Production на Cludex не развёртывался; действующие Client ID/Secret и пользовательские токены не использовались.

## Автоматические результаты

- PHP 8.3.36 CLI на Windows: синтаксис всех PHP-файлов PASS; 18 групп OAuth/security-тестов PASS (`php backend/tests/run.php`). Включён тест polling /me из второй вкладки во время OAuth: он не уничтожает pending state. Официальный portable PHP проверен по SHA-256 из windows.php.net и не установлен системно.
- [GitHub Actions, PHP 8.3 + MySQL 8.4](https://github.com/lenentwin/tkd-site/actions/runs/43471559021): SUCCESS. Миграции, настоящий PDO/MySQL, восемь параллельных регистраций (один пользователь), восемь параллельных claim state (одна успешная), повторный вход, роли/blocked, полный поток приложения с реальной DB и имитацией только ответов Яндекса. Фактический PHP HTTP entrypoint: health/me/start/callback errors/CORS/cookie/POST logout и последующий 401. Очистка expired records PASS.
- Frontend: lint, TypeScript/build PASS; 18 unit-тестов PASS (4 файла). Vitest исключает .cache, чтобы не запускать копии тестов из временного worktree; исходные тесты не удалены.
- Вариант `VITE_AUTH_ENABLED=true`, API=https://api.mft39.ru: production build PASS; 12 браузерных сценариев Edge на 390/1440 px PASS. Анонимный вход игнорирует demo storage, кнопка переходит на серверный OAuth start, профиль из API открывает кабинет, ошибка выхода сохраняет сессию/показывает ошибку, успех выхода открывает login, offline явно обозначен. 0 pageerror. Ответы API в этом тесте фиктивные и перехватываются только тестовым Playwright-скриптом.
- CSS не менялся. Конфигурация CORS/сессий проверена unit/HTTP; no-secret config.example и состав public/ проверены тестом. config.local.php и резервные имена исключены .gitignore. Backend/tests не входит в дистрибутив для хостинга.

## Покрытие сценариев из задания

| Требование | Доказательство |
|---|---|
| 1–2. Первый/повторный вход | PHP flow + MySQL integration, уникальная запись и прежняя роль |
| 3–4. Неверный/просроченный state | unit, без обращения к upstream |
| 5. Повтор code | callback replay не достигает upstream после первого claim; отдельный mock invalid code/reuse отклоняется; DB race claim |
| 6. Отказ пользователя | oauth_denied, одноразовый state, без создания user |
| 7–8. Недоступный/невалидный upstream | network/rejected/expired token/нет id/чужой client_id/невалидная структура: безопасная ошибка |
| 9–10. Нет сессии/выход | unit + реальные HTTP entrypoint/DB, cookie clearing и me=401 |
| 11. Повышение роли | query role игнорируется, отсутствует role endpoint, existing trainer сохраняется, default user |
| 12. Конкурентная регистрация | 8 отдельных PHP-процессов с одним Yandex ID и настоящим MySQL: одна строка |
| 13. CORS/CSRF | exact origin, OPTIONS/method/header checks, без origin/с чужим token logout=403; валидный logout=200 |
| 14. Секреты | public содержит только PHP entrypoints; production loader не подключает mocks; ошибки фиксированы; private config игнорируется; живых секретов нет |

Дополнительно: PKCE challenge/verifier, session rotation/fixation, absolute/idle TTL, blocked revocation, rate limit, HTTPS-only, запрет произвольных HTTP endpoints, timeout/body cap/TLS verify в CurlHttpClient.

## Границы

Живой Яндекс OAuth и сетевое окружение Cludex требуют ручного теста из DEPLOYMENT_RU.md. CI запускает только синтетические аккаунты/токены/секреты и тестовую DB mft39_auth_test; реальных персональных данных в зарубежном runner нет. Контейнер MySQL используется только для CI, на хостинге Docker не нужен. Изоляция публичной папки, права/open_basedir, список PHP extensions/CA, выключенные access/error logs и отсутствие nginx cache проверяются отдельно на MSK-2. Нельзя объявлять их подтверждёнными по локальным тестам.

Health подтверждает PHP/HTTPS, а не успешный OAuth. Реальная приёмка: внешний обмен code на сервере, запись пользователя в российской БД, собственная cookie, me=200, logout и me=401. До этого frontend-флаг выключен. Изменения отправлены в отдельную ветку и автоматически на main не публикуются.
