<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use Mft39\{Request,Config,App,Yandex};
use Mft39\Club\{Repository,Controller,Rules,Legal};
use Mft39\Tests\FakeHttp;
use function Mft39\Tests\{check,config};
use function Mft39\{randomToken,tokenHash};
$now=strtotime('2026-11-15T12:00:00Z');$cases=0;$repo=new Repository($pdo);
function pass(string $s):void {global $cases;$cases++;echo "PASS $s\n";}
function member(string $id,string $role='user'):array {
 global $repo,$store,$now;$u=$store->upsertUser($id);$repo->q('UPDATE users SET role=? WHERE id=?',[$role,$u['id']]);$sid=randomToken();$csrf=randomToken();$store->putSession(tokenHash($sid),['user_id'=>$u['id'],'csrf_token'=>$csrf,'created_at'=>$now,'last_seen_at'=>$now,'expires_at'=>$now+28800],null);return ['id'=>(int)$u['id'],'role'=>$role,'sid'=>$sid,'csrf'=>$csrf];
}
function api(?array $u,string $method,string $resource,array $body=[],array $query=[],array $headers=[]):\Mft39\Response {
 global $controller,$now;$h=['origin'=>'https://mft39.ru'];if($method==='POST'){$h+=['content-type'=>'application/json','x-csrf-token'=>$u['csrf']??''];}
 return $controller->handle(new Request($method,'/api/club',['resource'=>$resource]+$query,array_replace($h,$headers),$u?['__Host-mft39'=>$u['sid']]:[]),json_encode($body,JSON_THROW_ON_ERROR),$now);
}
function expected(\Mft39\Response $r,int $s,?string $code=null):array {check($r->status===$s,'Expected '.$s.', got '.$r->status.' '.($r->body['error']??''));if($code!==null){check(($r->body['error']??'')===$code);}return $r->body;}
$u=member('770000001');$v=member('770000002');$trainer=member('770000003','trainer');$controller=new Controller(config(),$store);
expected(api($u,'GET','bootstrap'),200);
$sourceDocuments=json_decode(file_get_contents(dirname(__DIR__).'/resources/legal-documents.json'),true,32,JSON_THROW_ON_ERROR);
// Draft rejection remains a synthetic fixture after the real documents are approved.
$drafts=array_map(function($d){$d['status']='draft';$d['version']='synthetic-draft-v1';return $d;},$sourceDocuments);
$docs=array_map(function($d){$d['status']='approved';$d['version']='synthetic-test-v1';$d['content']="# Synthetic test document\nTest consent fixture; no personal data.\n";$d['hash']=hash('sha256',$d['content']);return $d;},$drafts);
$cfg=new Config(array_replace(config()->values,['LEGAL_ENFORCEMENT'=>1]));$controller=new Controller($cfg,$store,$docs);
expected(api($u,'GET','bootstrap'),503,'legal_migration_required');
$controller=new Controller($cfg,$store,$drafts);expected(api($u,'GET','bootstrap'),403,'legal_documents_unavailable');pass('enforcement defaults off; missing migration and drafts fail closed when enabled');
$sql=preg_replace('/^\s*--[^\n]*$/m','',file_get_contents(dirname(__DIR__).'/migrations/004_legal_consents.sql'));foreach(explode(';',$sql) as $statement){if(trim($statement)!==''){$pdo->exec($statement);}}
$controller=new Controller($cfg,$store,$drafts);expected(api($u,'POST','legal-accept',['documents'=>[]]),403,'legal_documents_unavailable');
$state=expected(api($u,'GET','legal'),200);check($state['required']&&!$state['canAccept']&&count($state['documents'])===4);pass('additive migration applies and unapproved source documents cannot be accepted');
$controller=new Controller($cfg,$store,$docs);
function proof(string $type):array {global $docs;$d=array_values(array_filter($docs,fn($d)=>$d['type']===$type))[0];return array_intersect_key($d,array_flip(['type','version','hash']))+['accepted'=>true];}
$accept=['documents'=>[proof('terms'),proof('user_consent')]];
foreach(['bootstrap','profile','students','applications','payments','admin-overview','devices'] as $resource){expected(api($u,'GET',$resource),403,'legal_required');}
expected(api(null,'GET','legal'),401);expected(api($u,'POST','legal-accept',$accept,headers:['x-csrf-token'=>'wrong']),403,'csrf_failed');
foreach([[],['documents'=>[proof('terms')]],['documents'=>[proof('terms'),proof('terms')]],$accept+['userId'=>$v['id']]] as $body){expected(api($u,'POST','legal-accept',$body),422);}
foreach([false,'true',1] as $checked){$bad=$accept;$bad['documents'][1]['accepted']=$checked;expected(api($u,'POST','legal-accept',$bad),422);}
$bad=$accept;$bad['documents'][0]['hash']=str_repeat('0',64);expected(api($u,'POST','legal-accept',$bad),422);check((int)$repo->q('SELECT COUNT(*) FROM legal_acceptances')->fetchColumn()===0);pass('direct requests require both distinct explicit confirmations, current hash, own session and CSRF');
$state=expected(api($u,'POST','legal-accept',$accept),200);check(!$state['required']&&count($state['accepted'])===2);
foreach(range(1,3) as $_){expected(api($u,'POST','legal-accept',$accept),200);}check((int)$repo->q('SELECT COUNT(*) FROM legal_acceptances WHERE user_id=?',[$u['id']])->fetchColumn()===2);
check(!$controller->handle(new Request('GET','/api/club',['resource'=>'legal'],['origin'=>'https://mft39.ru'],['__Host-mft39'=>$u['sid']]),'', $now)->body['required']);
check(expected(api($v,'GET','legal'),200)['accepted']===[]);expected(api($v,'GET','students'),403,'legal_required');
$row=$repo->q('SELECT * FROM legal_acceptances WHERE user_id=? LIMIT 1',[$u['id']])->fetch();check($row['confirmed_at']===Rules::utc($now)&&$row['subject_key']==='account');pass('MySQL persists own account confirmations and retries never duplicate or change original time');
// Changed text with the same version also requires a fresh confirmation.
$oldDocs=$docs;$docs[0]['content'].="Updated synthetic terms.\n";$docs[0]['hash']=hash('sha256',$docs[0]['content']);$controller=new Controller($cfg,$store,$docs);
expected(api($u,'GET','students'),403,'legal_required');expected(api($u,'POST','legal-accept',['documents'=>[proof('terms')]]),200);
check(count(expected(api($u,'GET','legal'),200)['accepted'])===3);pass('changed terms hash prompts only the missing confirmation; prior evidence is preserved');
$input=['students'=>[['lastName'=>'Проверочный','firstName'=>'Тест','birthYear'=>2017]],'locationId'=>'chelnokova','requestedDate'=>'2026-11-22','consent'=>true,'consentVersion'=>Rules::CONSENT_VERSION,'guardian'=>['lastName'=>'Пример','firstName'=>'Родитель','phone'=>'+70000000000','relationship'=>'parent']];
$count=(int)$repo->q('SELECT COUNT(*) FROM club_students')->fetchColumn();
expected(api($u,'POST','applications',$input,headers:['idempotency-key'=>'legal-missing-guardian-key']),422,'guardian_consent_required');check((int)$repo->q('SELECT COUNT(*) FROM club_students')->fetchColumn()===$count);
$input['students'][0]['guardianConsent']=proof('guardian_consent');$input['students'][]=['lastName'=>'Проверочная','firstName'=>'Проба','birthYear'=>2018];
expected(api($u,'POST','applications',$input,headers:['idempotency-key'=>'legal-partial-guardian-key']),422,'guardian_consent_required');check((int)$repo->q('SELECT COUNT(*) FROM club_students')->fetchColumn()===$count);pass('missing representative consent for any child rolls back the entire multi-child enrollment');
$input['students'][1]['guardianConsent']=proof('guardian_consent');$saved=expected(api($u,'POST','applications',$input,headers:['idempotency-key'=>'legal-complete-guardian-key']),200);
check(count($saved['applicationIds'])===2);check($repo->q('SELECT consent_version FROM club_application_batches WHERE id=?',[$saved['batchId']])->fetchColumn()==='legal-acceptance-refs-v1');$rows=$repo->q("SELECT * FROM legal_acceptances WHERE user_id=? AND document_type='guardian_consent'",[$u['id']])->fetchAll();check(count($rows)===2&&count(array_unique(array_column($rows,'student_id')))===2);
foreach($rows as $row){check($row['application_id']===$row['subject_key']&&in_array($row['application_id'],$saved['applicationIds'],true)&&$row['confirmed_at']===Rules::utc($now));}
check(expected(api($u,'POST','applications',$input,headers:['idempotency-key'=>'legal-complete-guardian-key']),200)['replayed']);check((int)$repo->q("SELECT COUNT(*) FROM legal_acceptances WHERE document_type='guardian_consent'")->fetchColumn()===2);pass('each child consent is linked to its own MySQL student/application and idempotent replay does not duplicate evidence');
$repo->q('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)',[$trainer['id'],'chelnokova',Rules::utc($now)]);
expected(api($trainer,'GET','applications'),403,'legal_required');expected(api($trainer,'POST','legal-accept',['documents'=>[proof('terms'),proof('user_consent')]]),200);
$staff=expected(api($trainer,'GET','applications'),200);check(count($staff['items'])>=2);expected(api($u,'POST','payment',['studentId'=>$rows[0]['student_id'],'month'=>'2026-11','status'=>'paid','expectedVersion'=>0,'expectedCurrentMonth'=>'2026-11','reason'=>'']),403,'forbidden');
$sessionState=(new App($cfg,$store,new Yandex($cfg,new FakeHttp())))->handle(new Request('GET','/api/me',cookies:['__Host-mft39'=>$v['sid']]),$now);check($sessionState->status===200&&$sessionState->body['legal']['required']);
expected(api($u,'GET','legal',headers:['origin'=>'https://wrong.invalid']),403,'origin_not_allowed');pass('staff workflow, role enforcement, OAuth session metadata and exact CORS remain intact');
$native=randomToken();$nativeId=Rules::uuid();$repo->q('INSERT INTO club_device_tokens(id,user_id,label,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)',[$nativeId,$trainer['id'],'Synthetic native',tokenHash($native),$now,$now+600]);
$nativeCall=fn($resource,$method='GET',$body=[])=>$controller->handle(new Request($method,'/api/club',['resource'=>$resource],['authorization'=>'Bearer '.$native,'content-type'=>'application/json']),json_encode($body),$now);
expected($nativeCall('bootstrap'),200);expected($nativeCall('legal-accept','POST',$accept),403,'legal_browser_required');
$repo->q("UPDATE users SET status='blocked' WHERE id=?",[$u['id']]);expected(api($u,'GET','legal'),403,'account_blocked');pass('native devices retain scoped API but cannot impersonate a browser confirmation; blocked accounts remain denied');
// Verify cascading child erasure is consistent with existing admin deletion.
$pdo->beginTransaction();$child=$rows[0]['student_id'];$repo->q('DELETE FROM club_applications WHERE student_id=?',[$child]);check((int)$repo->q('SELECT COUNT(*) FROM legal_acceptances WHERE student_id=?',[$child])->fetchColumn()===0);$pdo->rollBack();
check((int)$repo->q('SELECT COUNT(*) FROM legal_acceptances WHERE student_id=?',[$child])->fetchColumn()===1);pass('child evidence follows existing reviewed deletion transaction and rollback restores it');
echo "Legal MySQL tests: $cases groups passed\n";
