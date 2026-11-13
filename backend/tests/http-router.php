<?php
declare(strict_types=1);
// CLI-server TEST fixture only. Simulates TLS termination for HTTP header tests.
// Never upload tests/ to hosting or use this router for a production server.
if (PHP_SAPI !== 'cli-server' || getenv('MFT39_TEST_MYSQL') !== '1') { http_response_code(404); exit; }
$_SERVER['HTTPS'] = 'on';
require dirname(__DIR__) . '/public/index.php';
