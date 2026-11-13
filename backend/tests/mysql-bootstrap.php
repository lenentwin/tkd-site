<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
require __DIR__ . '/Fakes.php';
// Explicit test database guard: never run fixtures against an application DB.
if (getenv('MFT39_TEST_MYSQL') !== '1' || getenv('DB_NAME') !== 'mft39_auth_test') {
    throw new RuntimeException('Use only the isolated mft39_auth_test database');
}
$pdo = new PDO('mysql:host=' . (getenv('DB_HOST') ?: '127.0.0.1') . ';port=' . (getenv('DB_PORT') ?: '3306') . ';dbname=mft39_auth_test;charset=utf8mb4',
    getenv('DB_USER') ?: 'root', getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$store = new \Mft39\MysqlStore($pdo);
