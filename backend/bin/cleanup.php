<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/src/bootstrap.php';
try {
    \Mft39\MysqlStore::connect(\Mft39\Config::load(dirname(__DIR__)))->cleanup(time());
    echo "Expired authentication records removed.\n";
} catch (Throwable) { fwrite(STDERR, "Cleanup failed; check private server configuration.\n"); exit(1); }
