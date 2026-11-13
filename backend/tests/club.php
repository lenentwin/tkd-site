<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use Mft39\{Request,ApiError};
use Mft39\Club\{Rules,Controller,Repository};
use function Mft39\Tests\{config,check};
use function Mft39\{randomToken,tokenHash};
$migration=preg_replace('/^\s*--[^\n]*$/m','',file_get_contents(dirname(__DIR__).'/migrations/002_club.sql'));
foreach(explode(';',$migration) as $sql){if(trim($sql)!==''){$pdo->exec($sql);}}
$now=strtotime('2026-11-15T12:00:00Z');$controller=new Controller(config(),$store);$repo=new Repository($pdo);$cases=0;
function pass(string $name):void{global $cases;$cases++;echo 'PASS '.$name."\n";}
function actor(string $yandex,string $role):array{
    global $store,$pdo,$now;$user=$store->upsertUser($yandex);$s=$pdo->prepare('UPDATE users SET role=? WHERE id=?');$s->execute([$role,$user['id']]);
    $sid=randomToken();$csrf=randomToken();$store->putSession(tokenHash($sid),['user_id'=>$user['id'],'csrf_token'=>$csrf,'created_at'=>$now,'last_seen_at'=>$now,'expires_at'=>$now+9999999],null);
    return ['id'=>(int)$user['id'],'role'=>$role,'sid'=>$sid,'csrf'=>$csrf];
}
function call(?array $actor,string $method,string $resource,array $data=[],array $query=[],array $headers=[],?int $time=null):\Mft39\Response{
    global $controller,$now;$h=['origin'=>'https://mft39.ru'];if($method==='POST'){$h+=['content-type'=>'application/json','x-csrf-token'=>$actor['csrf']??''];}
    return $controller->handle(new Request($method,'/api/club',array_merge(['resource'=>$resource],$query),array_replace($h,$headers),$actor?['__Host-mft39'=>$actor['sid']]:[]),json_encode($data,JSON_THROW_ON_ERROR),$time??$now);
}
$parent=actor('990000001','user');$other=actor('990000002','user');$trainer=actor('990000003','trainer');$outside=actor('990000004','trainer');$head=actor('990000005','head_trainer');$admin=actor('990000006','admin');
$pdo->prepare('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)')->execute([$trainer['id'],'chelnokova',Rules::utc($now)]);
$pdo->prepare('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)')->execute([$outside['id'],'city',Rules::utc($now)]);
check(call(null,'GET','bootstrap')->status===401);check(call($parent,'GET','bootstrap',headers:['origin'=>'https://evil.invalid'])->status===403);
check(call($parent,'POST','applications',headers:['x-csrf-token'=>'bad'])->status===403);pass('authentication, exact CORS and CSRF');
$input=['students'=>[['lastName'=>'Проверкин','firstName'=>'Тест','middleName'=>'','age'=>9]],'locationId'=>'chelnokova','requestedDate'=>'2026-11-20','guardian'=>['lastName'=>'Проверкин','firstName'=>'Пример','middleName'=>'','phone'=>'+70000000000','relationship'=>'parent'],'comment'=>'Синтетический тест'];
$created=call($parent,'POST','applications',$input,headers:['idempotency-key'=>'first-test-request-key']);check($created->status===200,'Create failed');$appId=$created->body['applicationIds'][0];
$application=$pdo->query("SELECT * FROM club_applications WHERE id='$appId'")->fetch();$student=$application['student_id'];
check($application['status']==='pending'&&(int)$pdo->query('SELECT COUNT(*) FROM club_student_guardians')->fetchColumn()===1);
check($pdo->query("SELECT learning_status FROM club_students WHERE id='$student'")->fetchColumn()==='trial');pass('real MySQL pending application, trial student and guardian');
$again=call($parent,'POST','applications',$input,headers:['idempotency-key'=>'first-test-request-key']);check($again->body['replayed']&&$again->body['applicationIds'][0]===$appId);
check(call($parent,'POST','applications',array_replace($input,['comment'=>'Changed']),headers:['idempotency-key'=>'first-test-request-key'])->status===409);
check(call($parent,'POST','applications',$input,headers:['idempotency-key'=>'different-request-key'])->status===409);
check((int)$pdo->query('SELECT COUNT(*) FROM club_students')->fetchColumn()===1);pass('idempotent retries, changed payload and duplicate pending applications');
check(call($trainer,'GET','students')->body['items']===[]);check(count(call($trainer,'GET','applications')->body['items'])===1);check(call($outside,'GET','applications')->body['items']===[]);
check(call($outside,'POST','application-decision',['id'=>$appId,'status'=>'accepted','expectedVersion'=>1])->status===404);
check(call($parent,'POST','application-decision',['id'=>$appId,'status'=>'accepted','expectedVersion'=>1])->status===403);
check(call($other,'GET','payments',query:['studentId'=>$student])->status===404);check(call($other,'GET','students')->body['items']===[]);pass('pending exclusion and parent/trainer hall isolation');
check(call($trainer,'POST','application-decision',['id'=>$appId,'status'=>'rejected','expectedVersion'=>1])->status===200);
check(call($trainer,'GET','students')->body['items']===[]);check($pdo->query("SELECT admitted_at FROM club_students WHERE id='$student'")->fetchColumn()===null);pass('rejected application never activates a new student');
$input['requestedDate']='2026-11-21';$accepted=call($parent,'POST','applications',$input,headers:['idempotency-key'=>'second-test-request-key']);$next=$accepted->body['applicationIds'][0];
check(call($trainer,'POST','application-decision',['id'=>$next,'status'=>'accepted','expectedVersion'=>1])->status===200);
$row=call($trainer,'GET','students')->body['items'][0];check($row['admitted']&&$row['status']==='trial'&&$row['payment']['status']==='unpaid'&&$row['payment']['version']===0);
check(call($trainer,'POST','application-decision',['id'=>$next,'status'=>'rejected','expectedVersion'=>1])->status===409);pass('accepted admission and optimistic decision conflict');
check(call($trainer,'POST','student-status',['studentId'=>$student,'status'=>'permanent','expectedVersion'=>$row['version']])->status===200);
check(call($parent,'POST','student-status',['studentId'=>$student,'status'=>'permanent','expectedVersion'=>3])->status===403);
$payment=['studentId'=>$student,'month'=>'2026-11','status'=>'paid','expectedVersion'=>0,'expectedCurrentMonth'=>'2026-11'];
check(call($outside,'POST','payment',$payment)->status===404);$paid=call($trainer,'POST','payment',$payment);check($paid->status===200&&$paid->body['version']===1);
$stored=$pdo->query("SELECT * FROM club_payments WHERE student_id='$student'")->fetch();check((int)$stored['confirmed_by']===$trainer['id']&&$stored['confirmed_at']!==null);
check(call($trainer,'POST','payment',array_replace($payment,['status'=>'unpaid']))->status===409);pass('payment confirmation actor/time and stale update rejection');
$newMonth=strtotime('2026-11-30T22:00:00Z');$dec=$repo->students($trainer,$newMonth)['items'][0];check($dec['payment']['month']==='2026-12'&&$dec['payment']['status']==='unpaid'&&$dec['payment']['version']===0);
check($pdo->query("SELECT status FROM club_payments WHERE student_id='$student' AND month='2026-11-01'")->fetchColumn()==='paid');
$lateActor=$trainer;$lateActor['sid']=randomToken();$store->putSession(tokenHash($lateActor['sid']),['user_id'=>$trainer['id'],'csrf_token'=>$trainer['csrf'],'created_at'=>$newMonth,'last_seen_at'=>$newMonth,'expires_at'=>$newMonth+3600],null);
check(call($lateActor,'POST','payment',$payment,time:$newMonth)->body['error']==='month_changed');
check(Rules::month(strtotime('2026-12-31T21:59:59Z'))==='2026-12'&&Rules::month(strtotime('2026-12-31T22:00:00Z'))==='2027-01');pass('Kaliningrad midnight, year rollover and immutable previous month without cron');
$correction=array_replace($payment,['status'=>'unpaid','expectedVersion'=>1]);check(call($trainer,'POST','payment',$correction)->status===422);
check(call($trainer,'POST','payment',array_replace($correction,['reason'=>'Исправление тестовой отметки']))->status===200);
$history=call($parent,'GET','changes',query:['studentId'=>$student]);check($history->status===200&&count($history->body['items'])>=6);
check(call($other,'GET','changes',query:['studentId'=>$student])->status===404);check(call($outside,'GET','changes')->body['items']===[]);
check(call($parent,'GET','payments',query:['studentId'=>$student])->body['items'][0]['status']==='unpaid');pass('correction reason, payment history and scoped immutable audit');
function raceClub(string $mode,array $actors,?string $student=null):array{
    $workers=[];for($i=0;$i<8;$i++){$args=[PHP_BINARY,__DIR__.'/club-race-worker.php',$mode,(string)$actors[$i%count($actors)]['id']];if($student){$args[]=$student;}$pipes=[];$p=proc_open($args,[1=>['pipe','w'],2=>['pipe','w']],$pipes);$workers[]=[$p,$pipes];}
    $results=[];foreach($workers as [$p,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($p)===0&&$err==='','Race worker failed');$results[]=$out;}return $results;
}
$r=raceClub('enroll',[$parent]);check(count(array_unique($r))===1&&$r[0]!=='error');
check((int)$pdo->query("SELECT COUNT(*) FROM club_students WHERE last_name='Параллельный'")->fetchColumn()===1);pass('8 concurrent enrollment retries create one batch/student/application');
$r=raceClub('payment',[$trainer,$head],$student);check(count(array_filter($r,fn($s)=>$s==='updated'))===1&&count(array_filter($r,fn($s)=>$s==='conflict'))===7);
check((int)$pdo->query("SELECT COUNT(*) FROM club_payments WHERE student_id='$student' AND month='2026-12-01'")->fetchColumn()===1);pass('8 concurrent monthly confirmations yield one record and seven conflicts');
$row=$repo->students($trainer,$now)['items'][0];check(call($trainer,'POST','student-status',['studentId'=>$student,'status'=>'inactive','expectedVersion'=>$row['version']])->status===200);
check($repo->students($trainer,$now)['items']===[]&&count($repo->students($trainer,$now,'','all')['items'])===1);
check((int)$pdo->query("SELECT COUNT(*) FROM club_payments WHERE student_id='$student'")->fetchColumn()===2);pass('deactivation preserves students, applications, audit and monthly history');
check(count(call($head,'GET','bootstrap')->body['halls'])===3&&count(call($admin,'GET','bootstrap')->body['halls'])===3&&count(call($trainer,'GET','bootstrap')->body['halls'])===1);pass('head/admin all halls and trainer assignments');
$device=call($trainer,'POST','device-create',['label'=>'Synthetic Android']);check($device->status===200);$token=$device->body['token'];$deviceId=$device->body['id'];
$native=function(?int $time=null)use($controller,$token,$now){return $controller->handle(new Request('GET','/api/club',['resource'=>'bootstrap'],['authorization'=>'Bearer '.$token]),'', $time??$now);};
check($native()->status===200);check($native($now+28800)->status===401);
check(call($parent,'POST','device-create',['label'=>'Forbidden'])->status===403);
$pdo->prepare("UPDATE users SET role='user' WHERE id=?")->execute([$trainer['id']]);check($native()->status===403);$pdo->prepare("UPDATE users SET role='trainer' WHERE id=?")->execute([$trainer['id']]);
check(call($trainer,'POST','device-revoke',['id'=>$deviceId])->status===200&&$native()->status===401);
check(!str_contains(json_encode($pdo->query('SELECT * FROM club_device_tokens')->fetchAll()),$token));
check(!str_contains(json_encode($pdo->query('SELECT details_json FROM club_audit')->fetchAll()),$token));pass('per-device hashed expiring tokens, live role checks, revocation, no shared APK secret');
echo "Club integration: $cases groups passed\n";
