<?php
declare(strict_types=1);
namespace Mft39;

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $error)
    { parent::__construct($error); }
}

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        public readonly array $headers = [],
        public readonly array $cookies = [],
        public readonly string $ip = '',
        public readonly bool $https = true,
    ) {}

    public static function globals(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $path = preg_replace('~/index\.php$~D', '', is_string($path) ? $path : '/');
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) { $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value; }
        }
        // CGI/FastCGI exposes these without HTTP_, including on PHP-FPM.
        if (isset($_SERVER['CONTENT_TYPE'])) { $headers['content-type'] = $_SERVER['CONTENT_TYPE']; }
        if (isset($_SERVER['CONTENT_LENGTH'])) { $headers['content-length'] = $_SERVER['CONTENT_LENGTH']; }
        return new self($_SERVER['REQUEST_METHOD'] ?? 'GET', rtrim($path, '/') ?: '/', $_GET, $headers, $_COOKIE,
            $_SERVER['REMOTE_ADDR'] ?? '', ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['SERVER_PORT'] ?? '') === '443');
    }
}

final class Response
{
    public function __construct(public int $status = 200, public array $body = [], public array $headers = []) {}

    public function cookie(?string $token): void
    {
        $this->headers['Set-Cookie'] = '__Host-mft39=' . ($token ?? '') . '; Path=/; Secure; HttpOnly; SameSite=Lax'
            . ($token === null ? '; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '');
    }

    public function send(): never
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) { header($name . ': ' . $value); }
        if ($this->status !== 204 && $this->status !== 302) {
            echo json_encode($this->body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
}

function randomToken(int $bytes = 32): string { return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '='); }
function tokenHash(string $value): string { return hash('sha256', $value); }
