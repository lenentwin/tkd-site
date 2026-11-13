# PHP backend MFT39

PHP 8.3 + PDO MySQL + cURL + JSON, без Composer/Node/Docker/root на хостинге. Яндекс OAuth с PKCE, собственные серверные сессии, профиль/выход и Club API: ученики, заявки, статусы обучения, ручные ежемесячные отметки оплаты, история и личные device-токены. Внешние OAuth-токены не сохраняются. Реальные данные принимает только российский сервер api.mft39.ru.

- [Первичная установка авторизации](docs/DEPLOYMENT_RU.md) и [Auth API](docs/API.md).
- [Обновление существующей базы для Club API](docs/DEPLOYMENT_CLUB_RU.md).
- [Контракт учеников/заявок/оплат](docs/CLUB_API.md).
- [Подключение отдельного Android-проекта](docs/ANDROID_CLUB.md).

Document root: только public/. src/, config.local.php, migrations/, bin/ и docs/ находятся снаружи всех публичных папок. Пример конфигурации пустой; секреты задаются только на сервере. Не загружайте tests/, .git, локальные файлы и ZIP/SQL-дампы в document root. Клиент не назначает себе роль, платежи не являются банковскими операциями.

```sh
php backend/tests/run.php
php backend/tests/club-rules.php
```

Workflow backend.yml проверяет синтаксис, OAuth/security, реальную MySQL 8.4, конкурентные транзакции, HTTP entrypoints и сохранность после перезапуска изолированной БД. Только синтетические данные и mft39_auth_test; production MySQL/OAuth не используются. Docker нужен только для CI-сервиса MySQL, не для Cludex. [Запуски проверок](https://github.com/lenentwin/tkd-site/actions/workflows/backend.yml).

Перед обработкой настоящих заявок владелец должен установить PHP и миграцию002 на действующем российском хостинге после резервной копии. Frontend ожидает bootstrap схемы2 и честно отключает отправку при недоступном сервисе. Android-исходников здесь нет, APK не изменён. Реальный вход и приёмка установки на Cludex не подменяются тестами с фиктивным Яндексом.