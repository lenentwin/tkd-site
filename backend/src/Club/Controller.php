<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\{ApiError,App,Config,MysqlStore,Request,Response};
use function Mft39\{randomToken,tokenHash};

final class Controller
{
    private Repository $repo; private Gate $gate;
    public function __construct(private Config $config,private MysqlStore $store,?array $legalDocuments=null) {
        $this->repo=new Repository($store->connection(),$config->get('LEGAL_ENFORCEMENT')===1,$legalDocuments);$this->gate=new Gate($config,$store,$this->repo);
    }
    public function handle(Request $request,string $rawBody='',?int $now=null): Response {
        $now??=time();$response=new Response(headers:App::securityHeaders());
        try{
            if(!$request->https){throw new ApiError(400,'https_required');}
            $origin=$request->headers['origin']??null;if($origin!==null&&$origin!==$this->config->get('FRONTEND_URL')){throw new ApiError(403,'origin_not_allowed');}
            if($origin!==null){$response->headers['Access-Control-Allow-Origin']=$origin;$response->headers['Access-Control-Allow-Credentials']='true';}
            if($request->method==='OPTIONS'){
                $headers=array_filter(array_map('trim',explode(',',strtolower($request->headers['access-control-request-headers']??''))));
                if($origin===null||!in_array($request->headers['access-control-request-method']??'', ['GET','POST'],true)||array_diff($headers,['content-type','x-csrf-token','idempotency-key'])){throw new ApiError(403,'preflight_not_allowed');}
                $response->status=204;$response->headers['Access-Control-Allow-Methods']='GET, POST';$response->headers['Access-Control-Allow-Headers']='Content-Type, X-CSRF-Token, Idempotency-Key';return $response;
            }
            if(!in_array($request->method,['GET','POST'],true)){$response->headers['Allow']='GET, POST';throw new ApiError(405,'method_not_allowed');}
            $actor=$this->gate->actor($request,$now);
            $bucket=hash_hmac('sha256','club:'.$actor['id'],$this->config->get('RATE_LIMIT_KEY'));
            if(!$this->store->allow($bucket,$now,600)){throw new ApiError(429,'rate_limited');}
            $resource=$request->query['resource']??'bootstrap';if(!is_string($resource)){throw new ApiError(422,'invalid_resource');}
            $legal=$this->repo->legal();
            if(!in_array($resource,['legal','legal-accept'],true)){$legal->assertAccess($actor);}
            $admin=new Admin($this->repo);
            if(str_starts_with($resource,'admin-')){Permissions::admin($actor);}
            if($request->method==='GET'){
                // A staff member can also be a guardian. Personal view only
                // reduces authority and never grants access to another family.
                $readActor=$actor;
                if(($request->query['view']??null)==='own'){$readActor['role']='user';}
                $cursor=$request->query['cursor']??'';if(!is_string($cursor)){throw new ApiError(422,'invalid_cursor');}
                $payload=match($resource){
                    'legal'=>$legal->status($actor),
                    'bootstrap'=>$this->repo->bootstrap($actor,$now),
                    'students'=>$this->repo->students($readActor,$now,$cursor===''?'':Rules::id($cursor),Rules::choice($request->query['status']??'active',['active','all','trial','permanent','inactive']),Rules::choice($request->query['archived']??'0',['0','1'])==='1'),
                    'student'=>$this->repo->detail($readActor,Rules::id($request->query['studentId']??null),$now),
                    'applications'=>$this->repo->applications($readActor,$cursor===''?'':Rules::id($cursor),Rules::choice($request->query['status']??'all',['all','pending','accepted','rejected']),$now),
                    'payments'=>$this->repo->payments($readActor,Rules::id($request->query['studentId']??null),$now,$cursor===''?'':$this->month($cursor)),
                    'changes'=>$this->repo->changes($readActor,$this->cursor($request->query['after']??'0'),isset($request->query['studentId'])?Rules::id($request->query['studentId']):null),
                    'devices'=>$this->devices($actor),
                    'profile'=>Profile::read($this->repo,$actor),
                    'admin-overview'=>$admin->overview($now),
                    'admin-users'=>$admin->users($request->query),
                    'admin-user'=>['user'=>$admin->user($admin->userId($request->query['userId']??null))],
                    'admin-halls'=>$admin->halls(),
                    'admin-students'=>$admin->students($request->query,$now),
                    'admin-applications'=>$admin->applications($request->query,$now),
                    'admin-audit'=>$admin->audit($request->query),
                    'student-delete-preview'=>$admin->deletePreview($actor,Rules::id($request->query['studentId']??null),$now),
                    default=>throw new ApiError(404,'not_found'),
                };
            }else{
                $this->gate->mutation($request,$actor);
                if(strlen($rawBody)>131072){throw new ApiError(413,'body_too_large');}
                if(!str_starts_with(strtolower($request->headers['content-type']??''),'application/json')){throw new ApiError(415,'json_required');}
                try{$data=json_decode($rawBody,true,32,JSON_THROW_ON_ERROR);}catch(\JsonException){throw new ApiError(422,'invalid_json');}
                if(!is_array($data)||array_is_list($data)){throw new ApiError(422,'invalid_json');}
                $payload=match($resource){
                    'legal-accept'=>$legal->accept($actor,$data,$now),
                    'applications'=>$this->create($actor,$data,$request,$now),
                    'application-decision'=>$this->repo->decide($actor,Rules::id($data['id']??null),Rules::choice($data['status']??null,['accepted','rejected']),Rules::version($data['expectedVersion']??null),$now),
                    'student-status'=>$this->repo->status($actor,Rules::id($data['studentId']??null),Rules::choice($data['status']??null,['trial','permanent','inactive']),Rules::version($data['expectedVersion']??null),Rules::text($data['reason']??'',500,false),$now),
                    'payment'=>$this->repo->payment($actor,Rules::id($data['studentId']??null),$this->month($data['month']??null),Rules::choice($data['status']??null,['paid','unpaid']),Rules::version($data['expectedVersion']??null),Rules::text($data['reason']??'',500,false),$this->month($data['expectedCurrentMonth']??null),$now),
                    'device-create'=>$this->createDevice($actor,$data,$now),
                    'device-revoke'=>$this->revokeDevice($actor,Rules::id($data['id']??null),$now),
                    'profile'=>Profile::save($this->repo,$actor,$data,$now),
                    'student-birth-year'=>$this->repo->birthYear($actor,Rules::id($data['studentId']??null),Rules::birthYear($data['birthYear']??null,$now),Rules::version($data['expectedVersion']??null),$now),
                    'admin-permissions-preview'=>$admin->preview($data),
                    'admin-user-update'=>$admin->updateUser($actor,$data,$now),
                    'admin-hall-save'=>$admin->saveHall($actor,$data,$now),
                    'student-archive'=>$this->repo->archive($actor,Rules::id($data['studentId']??null),Rules::version($data['expectedVersion']??null),Rules::text($data['reason']??null,500),false,$now),
                    'student-restore'=>$this->repo->archive($actor,Rules::id($data['studentId']??null),Rules::version($data['expectedVersion']??null),Rules::text($data['reason']??null,500),true,$now),
                    'student-delete'=>$admin->deleteStudent($actor,$data,$now),
                    default=>throw new ApiError(404,'not_found'),
                };
            }
            $response->body=array_merge(['ok'=>true,'currentMonth'=>Rules::month($now),'serverTime'=>gmdate('c',$now)],$payload);
        }catch(ApiError $e){$response->status=$e->status;$response->body=['ok'=>false,'error'=>$e->error,'currentMonth'=>Rules::month($now)];if($e->status===429){$response->headers['Retry-After']='600';}}
        return $response;
    }
    private function create(array $actor,array $data,Request $r,int $now): array {
        $bucket=hash_hmac('sha256','club-enroll:'.$actor['id'],$this->config->get('RATE_LIMIT_KEY'));
        if(!$this->store->allow($bucket,$now,30)){throw new ApiError(429,'rate_limited');}
        $key=$r->headers['idempotency-key']??null;if(!is_string($key)||!preg_match('/^[A-Za-z0-9_-]{16,80}$/D',$key)){throw new ApiError(422,'idempotency_key_required');}
        return $this->repo->enroll($actor,Rules::input($data,$now),$key,$now);
    }
    private function month(mixed $m): string { if(!is_string($m)||!preg_match('/^20[0-9]{2}-(0[1-9]|1[0-2])$/D',$m)){throw new ApiError(422,'invalid_month');}return $m; }
    private function cursor(mixed $v): int { if(!is_string($v)||!preg_match('/^[0-9]{1,15}$/D',$v)){throw new ApiError(422,'invalid_cursor');}return (int)$v; }
    private function devices(array $actor): array {
        if(!Repository::staff($actor)||$actor['native']){throw new ApiError(403,'forbidden');}
        return ['items'=>$this->repo->q('SELECT id,label,created_at,expires_at,revoked_at FROM club_device_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[$actor['id']])->fetchAll()];
    }
    private function createDevice(array $actor,array $data,int $now): array {
        if(!Repository::staff($actor)||$actor['native']){throw new ApiError(403,'forbidden');}
        $label=Rules::text($data['label']??null,80);return $this->repo->transaction($actor,function()use($actor,$label,$now){
            if((int)$this->repo->q('SELECT COUNT(*) FROM club_device_tokens WHERE user_id=? AND revoked_at IS NULL AND expires_at>?',[$actor['id'],$now])->fetchColumn()>=5){throw new ApiError(409,'device_limit');}
            $id=Rules::uuid();$token=randomToken();$this->repo->q('INSERT INTO club_device_tokens(id,user_id,label,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)',[$id,$actor['id'],$label,tokenHash($token),$now,$now+28800]);
            $this->repo->audit($actor,null,null,'device.created',$id,[],$now);return ['id'=>$id,'token'=>$token,'expiresAt'=>$now+28800];
        });
    }
    private function revokeDevice(array $actor,string $id,int $now): array {
        if(!Repository::staff($actor)||$actor['native']){throw new ApiError(403,'forbidden');}
        return $this->repo->transaction($actor,function()use($actor,$id,$now){
            $r=$this->repo->q('SELECT id FROM club_device_tokens WHERE id=? AND user_id=? FOR UPDATE',[$id,$actor['id']])->fetch();if(!$r){throw new ApiError(404,'not_found');}
            $this->repo->q('UPDATE club_device_tokens SET revoked_at=? WHERE id=?',[$now,$id]);$this->repo->audit($actor,null,null,'device.revoked',$id,[],$now);return ['id'=>$id,'revoked'=>true];
        });
    }
}
