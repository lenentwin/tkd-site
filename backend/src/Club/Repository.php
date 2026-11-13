<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

final class Repository
{
    public function __construct(private \PDO $db) {}
    public function q(string $sql,array $args=[]): \PDOStatement { $s=$this->db->prepare($sql);$s->execute($args);return $s; }
    public function transaction(array $actor,callable $work): mixed {
        for($attempt=0;;$attempt++){
            $this->db->beginTransaction();try {
                $fresh=$this->q('SELECT id,role,status FROM users WHERE id=? FOR UPDATE',[$actor['id']])->fetch();
                if(!$fresh||$fresh['status']!=='active'||$fresh['role']!==$actor['role']){throw new ApiError(403,'permissions_changed');}
                $result=$work();$this->db->commit();return $result;
            }catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}
                if($e instanceof \PDOException&&in_array((int)($e->errorInfo[1]??0),[1205,1213],true)&&$attempt<2){continue;}throw $e;
            }
        }
    }
    public static function staff(array $actor): bool { return in_array($actor['role'],['trainer','head_trainer','admin'],true); }
    public function halls(array $actor): array {
        if($actor['role']==='trainer'){return $this->q('SELECT h.* FROM club_halls h JOIN club_trainer_halls t ON t.hall_id=h.id WHERE t.user_id=? AND h.active=1 ORDER BY h.id',[$actor['id']])->fetchAll();}
        return $this->q('SELECT * FROM club_halls WHERE active=1 ORDER BY id')->fetchAll();
    }
    private function staffHall(array $actor,string $hall): void {
        if(!self::staff($actor)){throw new ApiError(403,'forbidden');}
        if($actor['role']==='trainer'&&!$this->q('SELECT user_id FROM club_trainer_halls WHERE user_id=? AND hall_id=? FOR SHARE',[$actor['id'],$hall])->fetch()){throw new ApiError(404,'not_found');}
    }
    private function scope(array $actor,string $alias='s'): array {
        if($actor['role']==='user'){return ["EXISTS(SELECT 1 FROM club_student_guardians g WHERE g.student_id=$alias.id AND g.user_id=?)",[$actor['id']]];}
        if($actor['role']==='trainer'){return ["EXISTS(SELECT 1 FROM club_trainer_halls t WHERE t.hall_id=$alias.hall_id AND t.user_id=?)",[$actor['id']]];}
        return ['1=1',[]];
    }
    public function student(array $actor,string $id,bool $lock=false): array {
        [$scope,$args]=$this->scope($actor);$row=$this->q('SELECT s.* FROM club_students s WHERE s.id=? AND '.$scope.($lock?' FOR UPDATE':''),array_merge([$id],$args))->fetch();
        if(!$row){throw new ApiError(404,'not_found');}return $row;
    }
    public function audit(?array $actor,?string $student,?string $hall,string $action,string $entity,array $details,int $now): void {
        $this->q('INSERT INTO club_audit(student_id,hall_id,actor_user_id,action,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)',[$student,$hall,$actor['id']??null,$action,$entity,json_encode($details,JSON_THROW_ON_ERROR),Rules::utc($now)]);
    }
    public function bootstrap(array $actor,int $now): array {
        if((int)$this->q('SELECT version FROM club_schema_version WHERE id=1')->fetchColumn()!==2){throw new ApiError(503,'migration_required');}
        $halls=$this->halls($actor);return ['schemaVersion'=>2,'actor'=>['id'=>(int)$actor['id'],'role'=>$actor['role']],'halls'=>$halls,'staff'=>self::staff($actor),
            'scopeVersion'=>hash('sha256',$actor['role'].':'.implode(',',array_column($halls,'id'))),'cursor'=>(int)$this->q('SELECT COALESCE(MAX(id),0) FROM club_audit')->fetchColumn(),'currentMonth'=>Rules::month($now),'serverTime'=>gmdate('c',$now)];
    }
    private function studentDto(array $r,string $month): array {
        return ['id'=>$r['id'],'locationId'=>$r['hall_id'],'lastName'=>$r['last_name'],'firstName'=>$r['first_name'],'middleName'=>$r['middle_name'],
            'age'=>(int)$r['age'],'ageRecordedOn'=>$r['age_recorded_on'],'status'=>$r['learning_status'],'admitted'=>$r['admitted_at']!==null,
            'createdAt'=>$r['created_at'].'Z','version'=>(int)$r['version'],'payment'=>['month'=>$month,'status'=>$r['payment_status']??'unpaid','version'=>(int)($r['payment_version']??0)]];
    }
    public function students(array $actor,int $now,string $cursor='',string $filter='active'): array {
        [$scope,$args]=$this->scope($actor);$where=$scope;
        if(self::staff($actor)){$where.=' AND s.admitted_at IS NOT NULL';if($filter==='active'){$where.=" AND s.learning_status<>'inactive'";}elseif($filter!=='all'){$where.=' AND s.learning_status=?';$args[]=$filter;}}
        if($cursor!==''){$where.=' AND s.id>?';$args[]=$cursor;}
        $month=Rules::month($now);$rows=$this->q("SELECT s.*,COALESCE(p.status,'unpaid') payment_status,COALESCE(p.version,0) payment_version FROM club_students s LEFT JOIN club_payments p ON p.student_id=s.id AND p.month=? WHERE $where ORDER BY s.id LIMIT 101",array_merge([$month.'-01'],$args))->fetchAll();
        $more=count($rows)>100;if($more){array_pop($rows);}return ['items'=>array_map(fn($r)=>$this->studentDto($r,$month),$rows),'nextCursor'=>$more?end($rows)['id']:null];
    }
    public function applications(array $actor,string $cursor=''): array {
        $where=$actor['role']==='user'?'a.applicant_id=?':($actor['role']==='trainer'?'EXISTS(SELECT 1 FROM club_trainer_halls t WHERE t.user_id=? AND t.hall_id=a.hall_id)':'1=1');
        $args=in_array($actor['role'],['user','trainer'],true)?[$actor['id']]:[];if($cursor!==''){$where.=' AND a.id>?';$args[]=$cursor;}
        $rows=$this->q("SELECT a.*,s.last_name,s.first_name,s.middle_name,s.age FROM club_applications a JOIN club_students s ON s.id=a.student_id WHERE $where ORDER BY a.id LIMIT 101",$args)->fetchAll();
        $more=count($rows)>100;if($more){array_pop($rows);}return ['items'=>array_map(fn($r)=>['id'=>$r['id'],'studentId'=>$r['student_id'],'locationId'=>$r['hall_id'],'lastName'=>$r['last_name'],'firstName'=>$r['first_name'],'middleName'=>$r['middle_name'],'age'=>(int)$r['age'],'requestedDate'=>$r['requested_date'],'comment'=>$r['comment'],'guardian'=>$r['representative_json']?json_decode($r['representative_json'],true,32,JSON_THROW_ON_ERROR):null,'status'=>$r['status'],'version'=>(int)$r['version'],'createdAt'=>$r['created_at'].'Z'],$rows),'nextCursor'=>$more?end($rows)['id']:null];
    }
    public function enroll(array $actor,array $input,string $key,int $now): array {
        $hash=hash('sha256',json_encode($input,JSON_THROW_ON_ERROR));
        return $this->transaction($actor,function()use($actor,$input,$key,$hash,$now){
            $old=$this->q('SELECT * FROM club_application_batches WHERE applicant_id=? AND idempotency_key=?',[$actor['id'],$key])->fetch();
            if($old){if(!hash_equals($old['request_hash'],$hash)){throw new ApiError(409,'idempotency_conflict');}return ['batchId'=>$old['id'],'applicationIds'=>$this->q('SELECT id FROM club_applications WHERE batch_id=? ORDER BY id',[$old['id']])->fetchAll(\PDO::FETCH_COLUMN),'replayed'=>true];}
            if(!$this->q('SELECT id FROM club_halls WHERE id=? AND active=1',[$input['locationId']])->fetch()){throw new ApiError(422,'invalid_hall');}
            $batch=Rules::uuid();$this->q('INSERT INTO club_application_batches(id,applicant_id,idempotency_key,request_hash,created_at) VALUES(?,?,?,?,?)',[$batch,$actor['id'],$key,$hash,Rules::utc($now)]);$ids=[];
            foreach($input['students'] as $s){
                if($s['id']!==null){
                    $student=$this->q('SELECT s.* FROM club_students s JOIN club_student_guardians g ON g.student_id=s.id WHERE s.id=? AND g.user_id=? FOR UPDATE',[$s['id'],$actor['id']])->fetch();
                    if(!$student){throw new ApiError(404,'not_found');}
                    if($student['last_name']!==$s['lastName']||$student['first_name']!==$s['firstName']||$student['middle_name']!==$s['middleName']||(int)$student['age']!==$s['age']){throw new ApiError(409,'student_changed');}
                }else{
                    // Never match names across families. The locked applicant row
                    // serializes duplicate first submissions from this account.
                    $student=$this->q('SELECT s.* FROM club_students s JOIN club_student_guardians g ON g.student_id=s.id WHERE g.user_id=? AND s.last_name=? AND s.first_name=? AND s.middle_name=? AND s.age=? ORDER BY s.id LIMIT 1 FOR UPDATE',[$actor['id'],$s['lastName'],$s['firstName'],$s['middleName'],$s['age']])->fetch();
                }
                if(!$student){
                    $id=Rules::uuid();$this->q("INSERT INTO club_students(id,hall_id,last_name,first_name,middle_name,age,age_recorded_on,learning_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'trial',?,?)",[$id,$input['locationId'],$s['lastName'],$s['firstName'],$s['middleName'],$s['age'],substr(Rules::utc($now),0,10),Rules::utc($now),Rules::utc($now)]);
                    $this->q('INSERT INTO club_student_guardians(student_id,user_id,relationship,created_at) VALUES(?,?,?,?)',[$id,$actor['id'],$s['age']<18?$input['guardian']['relationship']:'self',Rules::utc($now)]);
                    $this->audit($actor,$id,$input['locationId'],'student.created',$id,['status'=>'trial'], $now);
                    $student=['id'=>$id,'hall_id'=>$input['locationId']];
                }
                if($student['hall_id']!==$input['locationId']){throw new ApiError(409,'hall_change_requires_trainer');}
                if($this->q('SELECT id FROM club_applications WHERE student_id=? AND hall_id=? AND requested_date=?',[$student['id'],$input['locationId'],$input['requestedDate']])->fetch()){throw new ApiError(409,'duplicate_application');}
                $id=Rules::uuid();$this->q('INSERT INTO club_applications(id,batch_id,student_id,applicant_id,hall_id,requested_date,comment,representative_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[$id,$batch,$student['id'],$actor['id'],$input['locationId'],$input['requestedDate'],$input['comment'],$input['guardian']?json_encode($input['guardian'],JSON_THROW_ON_ERROR):null,Rules::utc($now)]);
                $ids[]=$id;$this->audit($actor,$student['id'],$input['locationId'],'application.created',$id,['status'=>'pending'], $now);
            }
            return ['batchId'=>$batch,'applicationIds'=>$ids,'replayed'=>false];
        });
    }
    public function decide(array $actor,string $id,string $decision,int $version,int $now): array {
        return $this->transaction($actor,function()use($actor,$id,$decision,$version,$now){
            $a=$this->q('SELECT * FROM club_applications WHERE id=? FOR UPDATE',[$id])->fetch();if(!$a){throw new ApiError(404,'not_found');}$this->staffHall($actor,$a['hall_id']);
            if((int)$a['version']!==$version||$a['status']!=='pending'){throw new ApiError(409,'version_conflict');}
            $this->q('UPDATE club_applications SET status=?,version=version+1,decided_by=?,decided_at=? WHERE id=?',[$decision,$actor['id'],Rules::utc($now),$id]);
            if($decision==='accepted'){$this->q('UPDATE club_students SET admitted_at=COALESCE(admitted_at,?),updated_at=?,version=version+1 WHERE id=?',[Rules::utc($now),Rules::utc($now),$a['student_id']]);}
            $this->audit($actor,$a['student_id'],$a['hall_id'],'application.'.$decision,$id,['from'=>'pending','to'=>$decision,'version'=>$version+1],$now);
            return ['id'=>$id,'status'=>$decision,'version'=>$version+1];
        });
    }
    public function status(array $actor,string $id,string $status,int $version,string $reason,int $now): array {
        return $this->transaction($actor,function()use($actor,$id,$status,$version,$reason,$now){
            $s=$this->student($actor,$id,true);$this->staffHall($actor,$s['hall_id']);if(!$s['admitted_at']){throw new ApiError(409,'admission_required');}if((int)$s['version']!==$version){throw new ApiError(409,'version_conflict');}
            if($s['learning_status']===$status){return ['id'=>$id,'status'=>$status,'version'=>$version];}
            $this->q('UPDATE club_students SET learning_status=?,version=version+1,updated_at=? WHERE id=?',[$status,Rules::utc($now),$id]);
            $this->audit($actor,$id,$s['hall_id'],'student.status',$id,['from'=>$s['learning_status'],'to'=>$status,'reason'=>$reason,'version'=>$version+1],$now);return ['id'=>$id,'status'=>$status,'version'=>$version+1];
        });
    }
    public function payments(array $actor,string $id,int $now,string $before=''): array {
        $this->student($actor,$id);$args=[$id];$where='';if($before!==''){$where=' AND month<?';$args[]=$before.'-01';}
        $rows=$this->q('SELECT * FROM club_payments WHERE student_id=?'.$where.' ORDER BY month DESC LIMIT 101',$args)->fetchAll();$more=count($rows)>100;if($more){array_pop($rows);}
        $items=array_map(fn($r)=>['month'=>substr($r['month'],0,7),'status'=>$r['status'],'version'=>(int)$r['version'],'confirmedBy'=>$r['confirmed_by']===null?null:(int)$r['confirmed_by'],'confirmedAt'=>$r['confirmed_at']===null?null:$r['confirmed_at'].'Z','updatedBy'=>(int)$r['updated_by'],'updatedAt'=>$r['updated_at'].'Z'],$rows);
        return ['items'=>$items,'currentMonth'=>Rules::month($now),'nextCursor'=>$more?substr(end($rows)['month'],0,7):null];
    }
    public function payment(array $actor,string $id,string $month,string $status,int $version,string $reason,string $expectedMonth,int $now): array {
        if($expectedMonth!==Rules::month($now)){throw new ApiError(409,'month_changed');}
        if($month>Rules::month($now)||($month!==Rules::month($now)&&$reason==='')){throw new ApiError(422,'correction_reason_required');}
        return $this->transaction($actor,function()use($actor,$id,$month,$status,$version,$reason,$now){
            $s=$this->student($actor,$id,true);$this->staffHall($actor,$s['hall_id']);if(!$s['admitted_at']){throw new ApiError(409,'admission_required');}
            $old=$this->q('SELECT * FROM club_payments WHERE student_id=? AND month=? FOR UPDATE',[$id,$month.'-01'])->fetch();
            if((int)($old['version']??0)!==$version){throw new ApiError(409,'version_conflict');}
            if($old&&$old['status']===$status){return ['studentId'=>$id,'month'=>$month,'status'=>$status,'version'=>$version];}
            if($old&&$old['status']==='paid'&&$status==='unpaid'&&$reason===''){throw new ApiError(422,'correction_reason_required');}
            $by=$status==='paid'?$actor['id']:($old['confirmed_by']??null);$at=$status==='paid'?Rules::utc($now):($old['confirmed_at']??null);
            $this->q('INSERT INTO club_payments(student_id,month,status,version,confirmed_by,confirmed_at,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),version=VALUES(version),confirmed_by=VALUES(confirmed_by),confirmed_at=VALUES(confirmed_at),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)',[$id,$month.'-01',$status,$version+1,$by,$at,$actor['id'],Rules::utc($now)]);
            $this->audit($actor,$id,$s['hall_id'],'payment.status',$id,['month'=>$month,'from'=>$old['status']??'unpaid','to'=>$status,'reason'=>$reason,'version'=>$version+1,'previousConfirmedBy'=>$old['confirmed_by']??null,'previousConfirmedAt'=>$old['confirmed_at']??null,'confirmedBy'=>$by,'confirmedAt'=>$at],$now);
            return ['studentId'=>$id,'month'=>$month,'status'=>$status,'version'=>$version+1];
        });
    }
    public function changes(array $actor,int $after,?string $studentId=null): array {
        if($studentId!==null){$this->student($actor,$studentId);}
        if($actor['role']==='user'){$where='EXISTS(SELECT 1 FROM club_student_guardians g WHERE g.student_id=a.student_id AND g.user_id=?)';$args=[$actor['id']];}
        elseif($actor['role']==='trainer'){$where='EXISTS(SELECT 1 FROM club_trainer_halls t WHERE t.hall_id=a.hall_id AND t.user_id=?)';$args=[$actor['id']];}else{$where='1=1';$args=[];}
        $args[]=$after;if($studentId!==null){$where.=' AND a.student_id=?';$args[]=$studentId;}
        $rows=$this->q('SELECT a.* FROM club_audit a WHERE '.$where.' AND a.id>? ORDER BY a.id LIMIT 101', $studentId===null?$args:array_merge(array_slice($args,0,-2),[$studentId,$after]))->fetchAll();
        $more=count($rows)>100;if($more){array_pop($rows);}return ['items'=>array_map(fn($r)=>['id'=>(int)$r['id'],'studentId'=>$r['student_id'],'locationId'=>$r['hall_id'],'actorId'=>$r['actor_user_id']===null?null:(int)$r['actor_user_id'],'action'=>$r['action'],'entityId'=>$r['entity_id'],'details'=>json_decode($r['details_json'],true,32,JSON_THROW_ON_ERROR),'createdAt'=>$r['created_at'].'Z'],$rows),'cursor'=>$rows?(int)end($rows)['id']:$after,'hasMore'=>$more];
    }
}
