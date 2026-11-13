<?php
declare(strict_types=1);
// Owner-only CLI outside the document root. Preview is the default.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__).'/src/bootstrap.php';
use Mft39\{Config,MysqlStore};
use Mft39\Club\{Repository,Rules};
$args=array_slice($argv,1);$apply=in_array('--apply',$args,true);$args=array_values(array_filter($args,fn($a)=>$a!=='--apply'));
if(count($args)!==3||!in_array($args[0],['role','grant','revoke'],true)||!ctype_digit($args[1])||(int)$args[1]<1){
    fwrite(STDERR,"Usage: php bin/staff.php role USER_ID user|trainer|head_trainer|admin [--apply]\n       php bin/staff.php grant|revoke USER_ID HALL_ID [--apply]\nWithout --apply: validate and preview only. Never put bin/ in public/.\n");exit(2);
}
try {
    [$command,$id,$value]=$args;$db=MysqlStore::connect(Config::load(dirname(__DIR__)))->connection();$repo=new Repository($db);$db->beginTransaction();
    $user=$repo->q('SELECT id,role FROM users WHERE id=? FOR UPDATE',[(int)$id])->fetch();if(!$user){throw new RuntimeException('Unknown user');}
    if($command==='role'){
        Rules::choice($value,['user','trainer','head_trainer','admin']);
        echo "User #$id: role {$user['role']} -> $value\n";
        if($apply&&$user['role']!==$value){$repo->q('UPDATE users SET role=? WHERE id=?',[$value,(int)$id]);$repo->audit(null,null,null,'staff.role',$id,['from'=>$user['role'],'to'=>$value,'source'=>'owner_cli'],time());}
    }else{
        if($user['role']!=='trainer'||!$repo->q('SELECT id FROM club_halls WHERE id=? AND active=1',[$value])->fetch()){throw new RuntimeException('Invalid trainer or hall');}
        $exists=(bool)$repo->q('SELECT user_id FROM club_trainer_halls WHERE user_id=? AND hall_id=?',[(int)$id,$value])->fetch();
        echo "User #$id: $command hall $value (currently ".($exists?'assigned':'unassigned').")\n";
        if($apply&&(($command==='grant'&&!$exists)||($command==='revoke'&&$exists))){
            if($command==='grant'){$repo->q('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)',[(int)$id,$value,Rules::utc(time())]);}
            else{$repo->q('DELETE FROM club_trainer_halls WHERE user_id=? AND hall_id=?',[(int)$id,$value]);}
            $repo->audit(null,null,$value,'staff.'.$command,$id,['source'=>'owner_cli'],time());
        }
    }
    if($apply){$db->commit();echo "Applied.\n";}else{$db->rollBack();echo "Preview only. Add --apply to change.\n";}
}catch(Throwable){if(isset($db)&&$db->inTransaction()){$db->rollBack();}fwrite(STDERR,"Command failed. Check user ID, allowed role/hall and private server configuration. No credentials are printed.\n");exit(1);}