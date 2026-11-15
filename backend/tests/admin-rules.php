<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/bootstrap.php';require __DIR__.'/Fakes.php';
use Mft39\Club\{Rules,Permissions};use Mft39\ApiError;use function Mft39\Tests\check;
check(Permissions::effective('user',['students.archive'=>true])===[]);
check(!in_array('students.archive',Permissions::effective('trainer'),true));
check(in_array('students.archive',Permissions::effective('head_trainer'),true));
check(Permissions::effective('admin',['payments.write'=>false])===Permissions::ALL);
check(!in_array('payments.write',Permissions::effective('trainer',['payments.write'=>false]),true));
check(in_array('students.restore',Permissions::effective('trainer',['students.restore'=>true]),true));
check(Permissions::assigned(['role'=>'trainer','hallScope'=>'all']));
check(Permissions::assigned(['role'=>'head_trainer','hallScope'=>'assigned']));
check(!Permissions::assigned(['role'=>'admin','hallScope'=>'assigned']));
$now=strtotime('2026-12-31T21:59:59Z');check(Rules::birthYear(2017,$now)===2017);
$base=['students'=>[['lastName'=>'Тест','firstName'=>'Пример','birthYear'=>2001,'age'=>1]],'locationId'=>'city','requestedDate'=>'2026-12-31','consent'=>true,'consentVersion'=>Rules::CONSENT_VERSION];
check(Rules::input($base,$now)['students'][0]['age']===25);
$base['requestedDate']='2027-01-01';check(Rules::input($base,$now+1)['students'][0]['age']===26);
foreach([2027,1899,'2017',null] as $bad){try{Rules::birthYear($bad,$now);check(false);}catch(ApiError $e){check($e->error==='invalid_birth_year');}}
$base['students'][0]['birthYear']=2008;
try{Rules::input($base,$now);check(false);}catch(ApiError $e){check($e->error==='guardian_required');}
echo "PASS effective permission defaults/denies, scopes, year rollover and conservative guardian validation\n";
