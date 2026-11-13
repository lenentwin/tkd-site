# Контракт API MFT39

Origin frontend: `https://mft39.ru`. API: `https://api.mft39.ru`.

| Метод и логический маршрут | Результат |
|---|---|
| GET /health | 200 `{"status":"ok"}`; проверяет PHP/HTTPS, не БД и OAuth |
| GET /auth/yandex/start | 302 на официальный authorize URL с PKCE S256 и state; pre-auth cookie |
| GET /auth/yandex/callback | проверяет одноразовый state, обменивает code, получает id, создаёт/находит user, ротирует сессию, 302 на https://mft39.ru/account |
| GET /api/me | 200 профиль и CSRF; 401 без действующей сессии; 403 для blocked |
| POST /api/logout | требует Origin и X-CSRF-Token; 200 `{"authenticated":false}`, удаление DB-сессии и cookie |

На тарифе без rewrite используйте физические адреса с `/` или `/index.php` в конце. Пример: `/api/me/`, `/api/logout/`, `/auth/yandex/start/`. PHP нормализует оба варианта. Клиент использует завершающий `/`, чтобы Nginx не преобразовал POST в GET при 301. Прямой POST `/api/logout` без rewrite может перенаправляться веб-сервером: такой адрес не следует использовать. Можно обращаться сразу к `/api/logout/index.php`. Это совместимый вариант из раздела 9 задания, не имитация Nginx rewrite.

Успешный профиль:

```json
{"authenticated":true,"user":{"id":1,"role":"user"},"csrfToken":"<43 символа base64url>"}
```

`id` внутренний. Допустимые роли: user/trainer/head_trainer. Yandex ID, имя, email, телефон и OAuth-токены клиенту не выдаются. csrfToken хранится только в памяти JavaScript, не является session ID. Реальные полномочия определяет только сервер; API смены ролей отсутствует. Новые аккаунты имеют только user.

Без сессии: HTTP 401 `{"authenticated":false,"error":"unauthenticated"}`. Ошибки состояния: invalid_state/expired_state (400), oauth_denied (400), oauth_rejected (400), oauth_unavailable/oauth_invalid_response (502). Ошибки origin/CSRF/blocked: 403. Ограничение частоты: 429 + Retry-After:600. Внутренний отказ: 503 `{"error":"service_unavailable"}` без деталей. В ответах нет отражения query/error_description или данных upstream.

Cookie `__Host-mft39`: HttpOnly; Secure; SameSite=Lax; Path=/; без Domain. Только API-поддомен; SameSite допускает top-level GET callback с Яндекса. Для fetch нужен credentials:include. Профиль возвращает только сессию, прошедшую проверки absolute/idle expiry и текущего статуса пользователя. Абсолютный срок по умолчанию 8 часов, idle 30 минут; pre-auth/state 5 минут. Cookie сессионная, без постоянного Max-Age. При выходе Max-Age=0.

CORS отражает только точный разрешённый Origin; с другим Origin возвращается 403 без Access-Control-Allow-Origin. OPTIONS проверяет маршрут, метод и список заголовков. Запрос logout без Origin отвергается даже с правильным CSRF. Все ответы: no-store, nosniff, no-referrer, запрет фреймов. Health публичен, ничего личного не содержит; он не устанавливает cookie и не требует конфигурации БД.

State хранится как SHA-256, привязан к SHA-256 session ID. SELECT FOR UPDATE и погашение до сетевого обмена обеспечивают один callback на state. После ошибки нужно начать новый вход. Токены Яндекса существуют только в памяти обработки callback и не попадают в собственную сессию. Хеши IP для rate limits получаются HMAC с серверным ключом, а не сохраняются как IP; старые окна очищаются. Используется REMOTE_ADDR, входящему X-Forwarded-For доверия нет.

Основа OAuth: [официальный Authorization Code + PKCE](https://yandex.ru/dev/id/doc/ru/codes/code-url), [API пользователя и client_id](https://yandex.ru/dev/id/doc/ru/user-information). API вызывается с Authorization header, а не OAuth-токеном в URL.
