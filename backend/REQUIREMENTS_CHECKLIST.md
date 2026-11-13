# Покрытие задания PHP backend

Источник: `C:/Users/manxinxx/.codex/attachments/8cffba59-f90d-42d3-9078-2ac253d45d26/Вставленный текст.txt` — 15 580 байт, 329 строк. Полностью прочитаны 1–170 и 171–329; последняя строка 329 подтверждена. Оригинал остаётся главным источником.

| Раздел | Реализация и контроль |
|---|---|
| 1. Инфраструктура | PHP 8.3, PDO/cURL/JSON, без runtime Node/Composer/Docker/root; файлы backend/ отдельно от Vite |
| 2. Изучение проекта | README/CODEX_HANDOFF/INTEGRATION_CONTRACT, AuthProvider, services/types/Login/Account прочитаны. Demo контракт сохранён, добавлен server mode и выключенный до приёмки адаптер |
| 3. OAuth | Yandex.php: code exchange на сервере, PKCE S256, минимальный scope, client_id/id validation, без сохранения токенов. App/Store: одноразовый session-bound state с TTL, ошибки/повторы |
| 4. MySQL | migrations/001_auth.sql, UTF8MB4, unique Yandex ID, native prepared statements, конкурентный upsert, новые user/active. Реальные race tests в CI |
| 5. Сессии | DB hash session ID, __Host cookie Secure/HttpOnly/Lax/Path=/ без Domain, ротация/удаление, absolute+idle TTL, CSRF+Origin, статус blocked проверяется при me |
| 6. API | start/callback/me/logout/health, методы/статусы/JSON; никаких анкет/оплат/расписаний/учеников |
| 7. CORS | точный mft39.ru, Credentials, ограниченный OPTIONS, reject чужих Origin; клиент credentials:include |
| 8. Конфигурация | приватный config.local.php и environment; пример без секретов, gitignore, HTTPS/таймауты/body cap, фиксированные ошибки, без stack/токенов в логах приложения. Журналы хостинга настраивает владелец |
| 9. ISPmanager | физические directory/index.php endpoints без root/rewrite; slash для POST, альтернативный callback index.php; manual-check public root/open_basedir/логи/CA/ext |
| 10. Тесты | 18 групп PHP, 18 frontend; MySQL 8.4 и 8 параллельных регистраций/claim state; PHP HTTP entrypoints; 12 browser scenarios с фиктивным API. См. TEST_REPORT |
| 11. Результат | полный backend, миграция, конфигурация, API, инструкции MySQL/OAuth/ISPmanager/приёмки. Реальные настройки делает владелец, секреты не запрашиваются |
| 12. Ограничения | нет записи/анкет/залов/APK/оплат/admin; дизайн/CSS не менялись. Live OAuth и Cludex не объявляются проверенными |

Стадия backend завершена кодом и автоматическими проверками. Публикация PHP на Cludex, действующие Client ID/Secret, импорт production БД и приёмка настоящего входа остаются ручными шагами владельца.
