<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\{ApiError,Config,Request,Store};
use function Mft39\tokenHash;

final class Gate
{
    public function __construct(private Config $config,private Store $store,private Repository $repo) {}
    public function actor(Request $request,int $now): array {
        $authorization=$request->headers['authorization']??null;
        if($authorization!==null){
            if(isset($request->headers['origin'])||!is_string($authorization)||!preg_match('/^Bearer ([A-Za-z0-9_-]{43})$/D',$authorization,$m)){throw new ApiError(401,'unauthenticated');}
            $device=$this->repo->q('SELECT * FROM club_device_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?',[tokenHash($m[1]),$now])->fetch();
            if(!$device){throw new ApiError(401,'unauthenticated');}$user=$this->store->user((string)$device['user_id']);
            if(!$user||$user['status']!=='active'||!Repository::staff($user)){throw new ApiError(403,'forbidden');}
            return ['id'=>(int)$user['id'],'role'=>$user['role'],'native'=>true,'csrf'=>null,'deviceId'=>$device['id']];
        }
        $token=$request->cookies['__Host-mft39']??null;
        if(!is_string($token)||!preg_match('/^[A-Za-z0-9_-]{43}$/D',$token)){throw new ApiError(401,'unauthenticated');}
        $hash=tokenHash($token);$session=$this->store->session($hash);
        if(!$session||$session['user_id']===null||$now>=(int)$session['expires_at']||$now-(int)$session['last_seen_at']>=$this->config->get('SESSION_IDLE_TTL')){
            if($session&&$session['user_id']!==null){$this->store->deleteSession($hash);}throw new ApiError(401,'unauthenticated');
        }
        $user=$this->store->user((string)$session['user_id']);if(!$user||$user['status']!=='active'||!in_array($user['role'],['user','trainer','head_trainer','admin'],true)){throw new ApiError(403,'forbidden');}
        $this->store->touch($hash,$now);return ['id'=>(int)$user['id'],'role'=>$user['role'],'native'=>false,'csrf'=>$session['csrf_token']];
    }
    public function mutation(Request $request,array $actor): void {
        if($actor['native']){return;}$csrf=$request->headers['x-csrf-token']??null;
        if(($request->headers['origin']??null)!==$this->config->get('FRONTEND_URL')||!is_string($csrf)||!hash_equals($actor['csrf'],$csrf)){throw new ApiError(403,'csrf_failed');}
    }
}
