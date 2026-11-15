<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use function Mft39\Tests\check;
check((int)$pdo->query("SELECT COUNT(*) FROM legal_acceptances a JOIN users u ON u.id=a.user_id WHERE u.yandex_user_id='770000001' AND a.subject_key='account'")->fetchColumn()===3);
check((int)$pdo->query("SELECT COUNT(*) FROM legal_acceptances a JOIN users u ON u.id=a.user_id WHERE u.yandex_user_id='770000001' AND a.document_type='guardian_consent'")->fetchColumn()===2);
check((int)$pdo->query('SELECT version FROM legal_schema_version WHERE id=1')->fetchColumn()===1);
echo "PASS MySQL restart/new PHP process preserves account and per-child legal evidence\n";
