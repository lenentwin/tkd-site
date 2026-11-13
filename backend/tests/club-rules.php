<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/bootstrap.php';require __DIR__.'/Fakes.php';
use Mft39\Club\Rules;use Mft39\ApiError;use function Mft39\Tests\check;
foreach(['2026-11-30T21:59:59Z'=>'2026-11','2026-11-30T22:00:00Z'=>'2026-12','2026-12-31T21:59:59Z'=>'2026-12','2026-12-31T22:00:00Z'=>'2027-01'] as $time=>$month){check(Rules::month(strtotime($time))===$month);}
check(Rules::day(strtotime('2026-11-30T22:00:00Z'))==='2026-12-01');
$base=['students'=>[['lastName'=>'Проверкин','firstName'=>'Тест','middleName'=>'','age'=>20]],'locationId'=>'chelnokova','requestedDate'=>'2026-11-15','comment'=>"Первая строка\nВторая строка"];
$now=strtotime('2026-11-14T22:00:00Z');check(Rules::input($base,$now)['students'][0]['age']===20);
foreach([array_replace($base,['requestedDate'=>'2026-02-31']),array_replace($base,['students'=>[['lastName'=>'x','firstName'=>'x','age'=>'20']]]),array_replace($base,['students'=>[['lastName'=>'x','firstName'=>'x','age'=>9]]]),array_replace($base,['comment'=>"bad\0comment"])] as $bad){try{Rules::input($bad,$now);check(false);}catch(ApiError $e){check($e->status===422);}}
try{Rules::version('1');check(false);}catch(ApiError $e){check($e->error==='version_required');}
for($i=0;$i<100;$i++){check(Rules::id(Rules::uuid())!=='');}
echo "PASS Kaliningrad boundaries, strict ages/versions, guardian/date/name validation and UUIDs\n";
