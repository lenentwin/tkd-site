<?php
declare(strict_types=1);
// Read-only fresh process AFTER the isolated MySQL service has been restarted.
require __DIR__.'/mysql-bootstrap.php';
use Mft39\Club\{Repository,Rules};
use function Mft39\Tests\check;
$repo=new Repository($pdo);
$student=$repo->q("SELECT * FROM club_students WHERE last_name='Проверкин' AND first_name='Тест'")->fetch();
check($student&&$student['learning_status']==='permanent'&&$student['admitted_at']!==null);
$payment=$repo->q("SELECT * FROM club_payments WHERE student_id=? AND month='2026-11-01'",[$student['id']])->fetch();
check($payment&&$payment['status']==='paid'&&(int)$payment['version']===3&&$payment['confirmed_by']!==null);
check((int)$repo->q('SELECT COUNT(*) FROM club_applications WHERE student_id=?',[$student['id']])->fetchColumn()===2);
check((int)$repo->q('SELECT COUNT(*) FROM club_audit WHERE student_id=?',[$student['id']])->fetchColumn()>=10);
$parent=$repo->q("SELECT id FROM users WHERE yandex_user_id='990000081'")->fetch();
check((int)$repo->q('SELECT COUNT(*) FROM club_student_guardians WHERE user_id=?',[$parent['id']])->fetchColumn()===120);
check((int)$repo->q('SELECT COUNT(*) FROM club_application_batches WHERE consent_version<>? OR consented_at IS NULL',[Rules::CONSENT_VERSION])->fetchColumn()===0);
echo "PASS fresh PHP process after MySQL restart: students, guardians, applications, consent, payments and audit persist\n";
