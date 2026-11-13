<?php
declare(strict_types=1);

// Copy to config.local.php OUTSIDE the web document root. Never commit that file.
return [
    'YANDEX_CLIENT_ID' => '',
    'YANDEX_CLIENT_SECRET' => '',
    'YANDEX_REDIRECT_URI' => 'https://api.mft39.ru/auth/yandex/callback',
    'FRONTEND_URL' => 'https://mft39.ru',
    // Leave empty if the registered application can identify a user without
    // additional rights. Otherwise use ONLY login:info (never email/phone/etc.).
    'YANDEX_SCOPE' => '',
    'DB_HOST' => 'localhost',
    'DB_PORT' => 3306,
    'DB_NAME' => '',
    'DB_USER' => '',
    'DB_PASSWORD' => '',
    'RATE_LIMIT_KEY' => '', // Generate locally: php -r "echo bin2hex(random_bytes(32));"
    'SESSION_TTL' => 28800,
    'SESSION_IDLE_TTL' => 1800,
    'OAUTH_TTL' => 300,
];
