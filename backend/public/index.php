<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '0');
error_reporting(E_ALL);
set_error_handler(static function (int $severity): never { throw new RuntimeException('Server runtime error', $severity); });

// With the recommended layout the document root is backend/public. If the
// host fixes the document root, set THIS path to your PRIVATE backend directory.
$privateRoot = dirname(__DIR__);
try {
    require $privateRoot . '/src/bootstrap.php';
    $request = \Mft39\Request::globals();
    // Health checks PHP/HTTPS only and never disclose DB/OAuth configuration.
    if ($request->path === '/health' && $request->method === 'GET' && $request->https) {
        (new \Mft39\Response(body: ['status' => 'ok'], headers: \Mft39\App::securityHeaders()))->send();
    }
    if (PHP_VERSION_ID < 80300 || !extension_loaded('pdo_mysql') || !extension_loaded('curl')) { throw new RuntimeException('Unsupported runtime'); }
    $config = \Mft39\Config::load($privateRoot);
    $app = new \Mft39\App($config, \Mft39\MysqlStore::connect($config), new \Mft39\Yandex($config, new \Mft39\CurlHttpClient()));
    $app->handle($request)->send();
} catch (Throwable) {
    // Never log exception messages, query strings, cookies or upstream bodies.
    error_log('MFT39 backend: request_failed');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":"service_unavailable"}';
}
