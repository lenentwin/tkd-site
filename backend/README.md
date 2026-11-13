# MFT39: PHP backend авторизации

PHP 8.3 + PDO MySQL + cURL + JSON, без Composer, Node.js, Docker или root на хостинге. Только авторизация, профиль и выход. MySQL хранит пользователей и серверные сессии; внешние OAuth-токены не сохраняются. Конфигурация production по умолчанию пустая и должна быть заполнена только на российском сервере.

Развёртывание и ручная приёмка: [docs/DEPLOYMENT_RU.md](docs/DEPLOYMENT_RU.md). Контракт: [docs/API.md](docs/API.md). Проверки и ограничения: [docs/TEST_REPORT.md](docs/TEST_REPORT.md). Все 12 разделов задания: [REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md).

Публичным document root должна быть **только папка public/**. src/, config.local.php, migrations/, bin/, docs/ размещаются снаружи. Веб-доступ ко всему backend/ недопустим. .htaccess для защиты не используется.

```sh
php backend/tests/run.php
```

Интеграционные тесты запускаются в GitHub Actions с отдельным MySQL 8.4 и исключительно фиктивными данными. Они не используют сервер Cludex или действующие аккаунты Яндекса. tests/ не загружается на хостинг.

Реальная пользовательская авторизация реализована в production-коде `src/Yandex.php`, а не в test doubles. Настоящий OAuth на api.mft39.ru требует Client ID/Secret, базы, загрузки файлов и ручной проверки владельцем. Доступа к ISPmanager и настройкам Яндекс-приложения при разработке не было.
