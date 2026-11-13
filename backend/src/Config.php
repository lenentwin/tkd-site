<?php
declare(strict_types=1);
namespace Mft39;

final class Config
{
    public function __construct(public readonly array $values)
    {
        foreach (['YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'RATE_LIMIT_KEY'] as $key) {
            if (!is_string($values[$key] ?? null) || trim($values[$key]) === '') {
                throw new \RuntimeException('Invalid server configuration');
            }
        }
        if (!preg_match('/^[a-f0-9]{32}$/iD', $values['YANDEX_CLIENT_ID']) || strlen($values['RATE_LIMIT_KEY']) < 64) {
            throw new \RuntimeException('Invalid server configuration');
        }
        if ($values['FRONTEND_URL'] !== 'https://mft39.ru' || !in_array($values['YANDEX_REDIRECT_URI'], [
            'https://api.mft39.ru/auth/yandex/callback',
            'https://api.mft39.ru/auth/yandex/callback/',
            'https://api.mft39.ru/auth/yandex/callback/index.php',
        ], true) || !in_array($values['YANDEX_SCOPE'], ['', 'login:info'], true)) {
            throw new \RuntimeException('Invalid public origins or OAuth scope');
        }
        foreach (['SESSION_TTL' => [300, 86400], 'SESSION_IDLE_TTL' => [60, 3600], 'OAUTH_TTL' => [60, 600], 'DB_PORT' => [1, 65535]] as $key => [$min, $max]) {
            if (!is_int($values[$key] ?? null) || $values[$key] < $min || $values[$key] > $max) {
                throw new \RuntimeException('Invalid server limits');
            }
        }
        if (preg_match('/[;\x00-\x20]/', $values['DB_HOST']) || !preg_match('/^[a-zA-Z0-9_]+$/D', $values['DB_NAME'])) {
            throw new \RuntimeException('Invalid database configuration');
        }
    }

    public static function load(string $root): self
    {
        $example = require $root . '/config.example.php';
        $path = $root . '/config.local.php';
        $local = is_file($path) ? require $path : [];
        if (!is_array($local)) { throw new \RuntimeException('Invalid server configuration'); }
        foreach (array_keys($example) as $key) {
            $env = getenv($key);
            if ($env !== false) {
                $local[$key] = is_int($example[$key]) ? filter_var($env, FILTER_VALIDATE_INT) : $env;
            }
        }
        return new self(array_replace($example, $local));
    }

    public function get(string $key): mixed { return $this->values[$key]; }
}
