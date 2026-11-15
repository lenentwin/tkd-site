<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use Mft39\{Request,App,Yandex};
use Mft39\Club\{Repository,Rules,Admin,Gate,Permissions,Profile};
use Mft39\Tests\FakeHttp;
use function Mft39\Tests\{check,config,cookie};
use function Mft39\{randomToken,tokenHash};
$repo=new Repository($pdo);$controller=new \Mft39\Club\Controller(config(),$store);$now=strtotime('2026-11-15T12:00:00Z');$passed=0;
function passed(string $name):void {global $passed;$passed++;echo "PASS $name\n";}
function member(string $yandex,string $role):array {
 global $store,$repo,$now;$u=$store->upsertUser($yandex);$repo->q('UPDATE users SET role=?,version=version+1 WHERE id=?',[$role,$u['id']]);$sid=randomToken();$csrf=randomToken();
 $store->putSession(tokenHash($sid),['user_id'=>$u['id'],'csrf_token'=>$csrf,'created_at'=>$now,'last_seen_at'=>$now,'expires_at'=>$now+9999999],null);
 return ['id'=>(int)$u['id'],'role'=>$role,'sid'=>$sid,'csrf'=>$csrf];
}
function api(?array $actor,string $method,string $resource,array $body=[],array $query=[],?int $time=null,array $headers=[]):\Mft39\Response {
 global $controller,$now;$h=['origin'=>'https://mft39.ru'];if($method==='POST'){$h+=['content-type'=>'application/json','x-csrf-token'=>$actor['csrf']??''];}
 return $controller->handle(new Request($method,'/api/club',array_merge(['resource'=>$resource],$query),array_replace($h,$headers),$actor?['__Host-mft39'=>$actor['sid']]:[]),json_encode($body,JSON_THROW_ON_ERROR),$time??$now);
}
function expected(\Mft39\Response $response,int $status,string $why=''):array {
 check($response->status===$status,($why!==''?$why:'HTTP status').': expected '.$status.', got '.$response->status.' ('.($response->body['error']??'ok').')');return $response->body;
}
function access(array $admin,array $target,array $changes=[]):array {
 $user=expected(api($admin,'GET','admin-user',query:['userId'=>(string)$target['id']]),200)['user'];
 $body=['userId'=>$target['id'],'role'=>$user['role'],'status'=>$user['status'],'hallScope'=>$user['hallScope'],'hallIds'=>$user['hallIds'],'overrides'=>(array)$user['overrides'],'expectedVersion'=>$user['version'],'reason'=>'Синтетическая проверка доступа'];
 return expected(api($admin,'POST','admin-user-update',array_replace($body,$changes)),200)['user'];
}
function enroll(array $parent,string $hall,string $name,int $year,string $key):array {
 $body=['students'=>[['lastName'=>$name,'firstName'=>'Тест','middleName'=>'','birthYear'=>$year]],'locationId'=>$hall,'requestedDate'=>'2026-11-22','consent'=>true,'consentVersion'=>Rules::CONSENT_VERSION,
 'guardian'=>['lastName'=>'Родитель','firstName'=>'Пример','middleName'=>'','phone'=>'+70000000000','relationship'=>'parent']];
 $result=expected(api($parent,'POST','applications',$body,headers:['idempotency-key'=>$key]),200);global $repo;$app=$repo->q('SELECT * FROM club_applications WHERE id=?',[$result['applicationIds'][0]])->fetch();
 return ['student'=>$app['student_id'],'app'=>$app['id'],'body'=>$body];
}
$parent=member('880000001','user');$other=member('880000002','user');$trainer=member('880000003','trainer');$outside=member('880000004','trainer');$head=member('880000005','head_trainer');$admin=member('880000006','admin');
foreach([[$trainer['id'],'chelnokova'],[$outside['id'],'city']] as [$id,$hall]){$repo->q('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)',[$id,$hall,Rules::utc($now)]);}
foreach(['admin-overview','admin-users','admin-halls','admin-students','admin-applications','admin-audit'] as $resource){expected(api($parent,'GET',$resource),403);expected(api($trainer,'GET',$resource),403);expected(api(null,'GET',$resource),401);}
expected(api($parent,'POST','admin-user-update',['userId'=>$parent['id'],'role'=>'admin']),403);
expected(api($parent,'POST','admin-permissions-preview',['role'=>'admin']),403);passed('all admin resources reject anonymous, ordinary user and trainer');

Profile::initialize($repo,$parent['id'],['first_name'=>'Пример','last_name'=>'Родитель','display_name'=>'Родитель Пример','access_token'=>'must-not-persist'],$now);
$p=expected(api($parent,'GET','profile'),200)['profile'];check($p['firstName']==='Пример'&&$p['displayName']==='Родитель Пример');
expected(api($parent,'POST','profile',['firstName'=>'Пример','lastName'=>'Родитель','middleName'=>'','expectedVersion'=>$p['version'],'role'=>'admin']),422);
$p=expected(api($parent,'POST','profile',['firstName'=>'Новое','lastName'=>'Родитель','middleName'=>'Имя','expectedVersion'=>$p['version']]),200)['profile'];
Profile::initialize($repo,$parent['id'],['first_name'=>'Не перезаписывать','last_name'=>'Другое'],$now+1);
check(expected(api($parent,'GET','profile'),200)['profile']['displayName']==='Родитель Новое Имя');check($store->user((string)$parent['id'])['role']==='user');
passed('Yandex name initialization, owner-only profile editing and no role injection or later overwrite');
$http=new FakeHttp();$app=new App(config(),$store,new Yandex(config(),$http));$start=$app->handle(new Request('GET','/auth/yandex/start',ip:'192.0.2.55'),$now);parse_str(parse_url($start->headers['Location'],PHP_URL_QUERY),$query);
$http->replies=[['access_token'=>'fictional-access','token_type'=>'bearer','expires_in'=>3600],['id'=>'880000099','first_name'=>'Имя','last_name'=>'Яндекс','display_name'=>'Никнейм','default_avatar_id'=>'do-not-store']];
$callback=$app->handle(new Request('GET','/auth/yandex/callback',['state'=>$query['state'],'code'=>'synthetic'],cookies:['__Host-mft39'=>cookie($start)]),$now+1);
check($callback->status===302);$me=$app->handle(new Request('GET','/api/me',cookies:['__Host-mft39'=>cookie($callback)]),$now+2);check($me->body['user']['displayName']==='Яндекс Имя'&&!str_contains(json_encode($me->body),'fictional-access'));passed('real auth callback path stores allowed Yandex names in MySQL without avatar/token');
$a=enroll($parent,'chelnokova','АдминПроверка',2017,'admin-real-enrollment-1');$b=enroll($other,'city','ДругойЗал',2016,'admin-real-enrollment-2');$c=enroll($parent,'school10','ТретийЗал',2018,'admin-real-enrollment-3');
$row=expected(api($trainer,'GET','student',query:['studentId'=>$a['student']]),200);check($row['birthYear']===2017&&$row['age']===9&&$row['guardians'][0]['displayName']==='Родитель Новое Имя');
$nextYear=$repo->detail($parent,$a['student'],strtotime('2026-12-31T22:00:00Z'));check($nextYear['age']===10);check((int)$repo->q('SELECT birth_year FROM club_students WHERE id=?',[$a['student']])->fetchColumn()===2017);
expected(api($other,'GET','student',query:['studentId'=>$a['student']]),404);expected(api($outside,'GET','student',query:['studentId'=>$a['student']]),404);
expected(api($outside,'POST','application-decision',['id'=>$a['app'],'status'=>'accepted','expectedVersion'=>1]),404);
expected(api($other,'POST','student-birth-year',['studentId'=>$a['student'],'birthYear'=>2015,'expectedVersion'=>$row['version']]),403);
passed('birth year persists, age rolls at Kaliningrad New Year, parent/staff names and IDOR isolation');
$perms=expected(api($admin,'POST','admin-permissions-preview',['role'=>'trainer','hallScope'=>'all','hallIds'=>['city'],'overrides'=>['students.archive'=>true,'payments.write'=>false]]),200);
check($perms['hallScope']==='assigned'&&in_array('students.archive',$perms['effectivePermissions'],true)&&!in_array('payments.write',$perms['effectivePermissions'],true));
access($admin,$trainer,['hallIds'=>['chelnokova','city']]);
check(count(expected(api($trainer,'GET','applications'),200)['items'])>=2);expected(api($trainer,'GET','student',query:['studentId'=>$c['student']]),404);
access($admin,$head,['hallScope'=>'assigned','hallIds'=>['city']]);expected(api($head,'GET','student',query:['studentId'=>$a['student']]),404);expected(api($head,'GET','student',query:['studentId'=>$b['student']]),200);
check(count(expected(api($head,'GET','bootstrap'),200)['halls'])===1);passed('server preview, multi-hall trainer and restricted head trainer');
access($admin,$trainer,['overrides'=>['applications.decide'=>false]]);
expected(api($trainer,'POST','application-decision',['id'=>$a['app'],'status'=>'accepted','expectedVersion'=>1]),403);
access($admin,$trainer,['overrides'=>[]]);
expected(api($trainer,'POST','application-decision',['id'=>$a['app'],'status'=>'accepted','expectedVersion'=>1]),200);
$row=expected(api($trainer,'GET','student',query:['studentId'=>$a['student']]),200);
expected(api($trainer,'POST','student-status',['studentId'=>$a['student'],'status'=>'permanent','expectedVersion'=>$row['version'],'reason'=>'Синтетическая проверка']),200);
$row=expected(api($trainer,'GET','student',query:['studentId'=>$a['student']]),200);
expected(api($trainer,'POST','payment',['studentId'=>$a['student'],'month'=>'2026-11','status'=>'paid','expectedVersion'=>0,'expectedCurrentMonth'=>'2026-11','reason'=>'']),200);
$oldActor=(new Gate(config(),$store,$repo))->actor(new Request('GET','/api/club',cookies:['__Host-mft39'=>$trainer['sid']]),$now);
access($admin,$trainer,['overrides'=>['payments.write'=>false,'students.status'=>false]]);
expected(api($trainer,'POST','payment',['studentId'=>$a['student'],'month'=>'2026-11','status'=>'unpaid','expectedVersion'=>1,'expectedCurrentMonth'=>'2026-11','reason'=>'Исправление']),403);
try{$repo->status($oldActor,$a['student'],'inactive',$row['version'],'', $now);check(false);}catch(\Mft39\ApiError $e){check($e->error==='permissions_changed');}
passed('revocation takes effect on next request and on previously captured in-flight authority');
expected(api($trainer,'POST','student-archive',['studentId'=>$a['student'],'expectedVersion'=>$row['version'],'reason'=>'Архив']),403);
access($admin,$trainer,['overrides'=>['students.archive'=>true,'students.restore'=>true]]);
$archived=expected(api($trainer,'POST','student-archive',['studentId'=>$a['student'],'expectedVersion'=>$row['version'],'reason'=>'Синтетическая причина архива']),200)['student'];
check($archived['archived']&&$archived['status']==='permanent'&&$archived['payment']['status']==='paid');
check(!in_array($a['student'],array_column(expected(api($trainer,'GET','students'),200)['items'],'id'),true));
check(in_array($a['student'],array_column(expected(api($trainer,'GET','students',query:['archived'=>'1','status'=>'all']),200)['items'],'id'),true));
expected(api($trainer,'POST','payment',['studentId'=>$a['student'],'month'=>'2026-11','status'=>'unpaid','expectedVersion'=>1,'expectedCurrentMonth'=>'2026-11','reason'=>'Синтетическая причина']),409);
expected(api($trainer,'POST','student-restore',['studentId'=>$b['student'],'expectedVersion'=>1,'reason'=>'Restore']),409);
$restored=expected(api($trainer,'POST','student-restore',['studentId'=>$a['student'],'expectedVersion'=>$archived['version'],'reason'=>'Вернулся на занятия']),200)['student'];
check(!$restored['archived']&&$restored['status']==='permanent'&&$restored['payment']['status']==='paid');
check(count(expected(api($trainer,'GET','payments',query:['studentId'=>$a['student']]),200)['items'])>=1);passed('individual archive/restore permission, separate learning state, lists and preserved payment/history');
expected(api($parent,'POST','student-birth-year',['studentId'=>$a['student'],'birthYear'=>2015,'expectedVersion'=>$restored['version']]),200);
$row=expected(api($parent,'GET','student',query:['studentId'=>$a['student']]),200);check($row['birthYear']===2015);
expected(api($parent,'POST','student-birth-year',['studentId'=>$a['student'],'birthYear'=>2027,'expectedVersion'=>$row['version']]),422);
passed('linked parent can correct birth year with version guard and no foreign-family access');
$overview=expected(api($admin,'GET','admin-overview'),200);check($overview['counts']['students']>0);
foreach(['admin-users','admin-students','admin-applications','admin-audit'] as $resource){$result=expected(api($admin,'GET',$resource,query:['page'=>'1','q'=>'%\' OR 1=1 --']),200);check(isset($result['items'],$result['pages'],$result['total']));}
expected(api($admin,'GET','admin-users',query:['page'=>'-1']),422);
$overview=expected(api($admin,'GET','admin-overview'),200);
$h=expected(api($admin,'POST','admin-hall-save',['id'=>'admin-test-hall','name'=>'Тестовый зал','address'=>'Синтетический адрес','active'=>true,'expectedVersion'=>0,'reason'=>'Проверка инфраструктуры']),200)['hall'];
expected(api($admin,'POST','admin-hall-save',['id'=>$h['id'],'name'=>'Тестовый зал','address'=>'Синтетический адрес','active'=>false,'expectedVersion'=>$h['version'],'reason'=>'Проверка закрытия']),200);
check(count(expected(api($admin,'GET','admin-halls'),200)['items'])>=4);passed('real statistics, paginated search/filter SQL injection probes and additive hall management');
$device=expected(api($trainer,'POST','device-create',['label'=>'Синтетическое устройство']),200);
$nativeHeaders=['authorization'=>'Bearer '.$device['token']];$native=function(string $resource)use($controller,$nativeHeaders,$now){return $controller->handle(new Request('GET','/api/club',['resource'=>$resource],$nativeHeaders),'',$now);};
$nativeBootstrap=$native('bootstrap');check($nativeBootstrap->status===200&&$nativeBootstrap->body['schemaVersion']===2&&$nativeBootstrap->body['capabilitiesVersion']===3);
access($admin,$trainer,['status'=>'blocked']);
expected(api($trainer,'GET','bootstrap'),403);check($native('bootstrap')->status===401);
$blockedProfile=$app->handle(new Request('GET','/api/me',cookies:['__Host-mft39'=>$trainer['sid']]),$now);check($blockedProfile->status===403&&$blockedProfile->body['error']==='account_blocked');
access($admin,$trainer,['status'=>'active']);expected(api($trainer,'GET','bootstrap'),401);
passed('block terminates existing browser/device access, friendly blocked reason and no old-session revival after unblock');
$archived=expected(api($admin,'POST','student-archive',['studentId'=>$a['student'],'expectedVersion'=>$row['version'],'reason'=>'Подготовка к удалению синтетической карточки']),200)['student'];
$preview=expected(api($admin,'GET','student-delete-preview',query:['studentId'=>$a['student']]),200);check($preview['eligible']&&$preview['related']['payments']===1);
expected(api($outside,'GET','student-delete-preview',query:['studentId'=>$a['student']]),403);
$delete=['studentId'=>$a['student'],'expectedVersion'=>$archived['version'],'confirmation'=>$preview['fullName'],'reason'=>'Тест удаления данных','reasonCode'=>'subject_request','retentionReviewed'=>true];
expected(api($parent,'POST','student-delete',$delete),403);
expected(api($admin,'POST','student-delete',array_replace($delete,['confirmation'=>'Wrong'])),422);
expected(api($admin,'POST','student-delete',array_replace($delete,['retentionReviewed'=>false])),422);
// A SQL failure after dependent deletes must roll the entire transaction back.
$pdo->exec("CREATE TRIGGER admin_delete_failure BEFORE DELETE ON club_students FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic failure'");
try{api($admin,'POST','student-delete',$delete);check(false);}catch(\PDOException){}finally{$pdo->exec('DROP TRIGGER admin_delete_failure');}
check((int)$repo->q('SELECT COUNT(*) FROM club_students WHERE id=?',[$a['student']])->fetchColumn()===1);
check((int)$repo->q('SELECT COUNT(*) FROM club_payments WHERE student_id=?',[$a['student']])->fetchColumn()===1);
expected(api($admin,'POST','student-delete',$delete),200);
foreach(['club_students'=>'id','club_applications'=>'student_id','club_payments'=>'student_id','club_student_guardians'=>'student_id'] as $table=>$column){check((int)$repo->q("SELECT COUNT(*) FROM $table WHERE $column=?",[$a['student']])->fetchColumn()===0);}
check($store->user((string)$parent['id'])!==null);check((int)$repo->q('SELECT COUNT(*) FROM club_audit WHERE student_id=?',[$a['student']])->fetchColumn()===0);
$events=$repo->q('SELECT details_json FROM club_audit WHERE entity_id=?',[$a['student']])->fetchAll();check(!str_contains(json_encode($events),'АдминПроверка'));
expected(api($parent,'POST','applications',$a['body'],headers:['idempotency-key'=>'admin-real-enrollment-1']),410);
passed('admin-only confirmed deletion, retention acknowledgement, full SQL rollback, parent preservation, audit redaction and retry tombstone');
$before=expected(api($admin,'GET','admin-audit',query:['userId'=>(string)$trainer['id']]),200);check($before['total']>0);
expected(api($admin,'POST','admin-audit',['action'=>'erase']),404);
passed('immutable audit with account-target search and history of changes');
// Isolated fixtures only: temporarily hold other admins to verify the global
// last-admin invariant and concurrent self-demotion under the same mutex.
$otherAdmins=$repo->q("SELECT id,status FROM users WHERE role='admin' AND id<>?",[$admin['id']])->fetchAll();
try {
 $repo->q("UPDATE users SET status='blocked' WHERE role='admin' AND id<>?",[$admin['id']]);
 $u=expected(api($admin,'GET','admin-user',query:['userId'=>(string)$admin['id']]),200)['user'];
 $change=['userId'=>$admin['id'],'role'=>'user','status'=>'active','hallScope'=>'assigned','hallIds'=>[],'overrides'=>[],'expectedVersion'=>$u['version'],'reason'=>'Проверка последнего администратора'];
 expected(api($admin,'POST','admin-user-update',$change),409);$change['role']='admin';$change['status']='blocked';expected(api($admin,'POST','admin-user-update',$change),409);
 $second=member('880000007','admin');$workers=[];
 foreach([$admin['id'],$second['id']] as $id){$pipes=[];$process=proc_open([PHP_BINARY,__DIR__.'/admin-race-worker.php',(string)$id],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$workers[]=[$process,$pipes];}
 $out=[];foreach($workers as [$process,$pipes]){$text=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);check(proc_close($process)===0&&$error==='');$out[]=$text;}
 sort($out);check($out===['last_active_admin','updated']);check((int)$repo->q("SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'")->fetchColumn()===1);
} finally {foreach($otherAdmins as $u){$repo->q('UPDATE users SET status=? WHERE id=?',[$u['status'],$u['id']]);}}
passed('last active admin cannot be blocked/demoted, including concurrent requests');
echo "Admin MySQL: $passed scenario groups passed\n";
