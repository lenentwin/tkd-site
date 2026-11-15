<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

final class Admin
{
    public function __construct(private Repository $repo) {}
    private function q(string $sql,array $args=[]): \PDOStatement { return $this->repo->q($sql,$args); }
    private function page(array $query): int {
        $page=$query['page']??'1';if(!is_string($page)||!preg_match('/^[1-9][0-9]{0,3}$/D',$page)){throw new ApiError(422,'invalid_page');}return (int)$page;
    }
    private function search(array $query): string { return Rules::text($query['q']??'',200,false); }
    private function date(mixed $value): string {
        if(!is_string($value)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$value)){throw new ApiError(422,'invalid_date');}
        $date=\DateTimeImmutable::createFromFormat('!Y-m-d',$value);
        if(!$date||$date->format('Y-m-d')!==$value){throw new ApiError(422,'invalid_date');}return $value;
    }
    private function dates(array $query,string $column,array &$where,array &$args): void {
        $zone=new \DateTimeZone('Europe/Kaliningrad');
        if(($query['from']??'')!==''){$where[]="$column>=?";$args[]=Rules::utc((new \DateTimeImmutable($this->date($query['from']),$zone))->getTimestamp());}
        if(($query['to']??'')!==''){$where[]="$column<?";$args[]=Rules::utc((new \DateTimeImmutable($this->date($query['to']),$zone))->modify('+1 day')->getTimestamp());}
    }
    private function paged(string $select,string $from,array $where,array $args,int $page,string $order): array {
        $clause=$where?' WHERE '.implode(' AND ',$where):'';
        $total=(int)$this->q("SELECT COUNT(*) $from$clause",$args)->fetchColumn();$offset=($page-1)*50;
        return ['items'=>$this->q("$select $from$clause ORDER BY $order LIMIT 50 OFFSET $offset",$args)->fetchAll(),'page'=>$page,'pages'=>max(1,(int)ceil($total/50)),'total'=>$total];
    }
    public function user(int $id): array {
        $row=$this->q('SELECT * FROM users WHERE id=?',[$id])->fetch();if(!$row){throw new ApiError(404,'not_found');}
        $overrides=[];foreach($this->q('SELECT permission,allowed FROM club_user_permissions WHERE user_id=?',[$id])->fetchAll() as $permission){$overrides[$permission['permission']]=(bool)$permission['allowed'];}
        $halls=$this->q('SELECT hall_id FROM club_trainer_halls WHERE user_id=? ORDER BY hall_id',[$id])->fetchAll(\PDO::FETCH_COLUMN);
        return array_merge(['id'=>$id,'role'=>$row['role'],'status'=>$row['status'],'createdAt'=>Rules::iso($row['created_at']),'lastLoginAt'=>$row['last_login_at']?Rules::iso($row['last_login_at']):null,
            'hallScope'=>$row['role']==='trainer'?'assigned':$row['hall_scope'],'hallIds'=>$halls,'overrides'=>(object)$overrides,'effectivePermissions'=>Permissions::effective($row['role'],$overrides)],Profile::dto($row));
    }
    public function users(array $query): array {
        $where=[];$args=[];$q=$this->search($query);
        if($q!==''){$where[]="(CONCAT_WS(' ',last_name,first_name,middle_name,display_name) LIKE ? OR CAST(id AS CHAR)=?)";$args[]='%'.$q.'%';$args[]=$q;}
        if(($query['role']??'')!==''){$where[]='role=?';$args[]=Rules::choice($query['role'],['user','trainer','head_trainer','admin']);}
        if(($query['status']??'')!==''){$where[]='status=?';$args[]=Rules::choice($query['status'],['active','blocked']);}
        $result=$this->paged('SELECT id','FROM users',$where,$args,$this->page($query),'id DESC');
        $result['items']=array_map(fn($r)=>$this->user((int)$r['id']),$result['items']);return $result;
    }
    public function preview(array $data): array {
        $role=Rules::choice($data['role']??null,['user','trainer','head_trainer','admin']);
        $scope=$role==='head_trainer'?Rules::choice($data['hallScope']??'all',['all','assigned']):($role==='admin'?'all':'assigned');
        $ids=$data['hallIds']??[];
        if(!is_array($ids)||!array_is_list($ids)||count($ids)>200){throw new ApiError(422,'invalid_halls');}
        $hallIds=[];foreach($ids as $id){$id=Rules::text($id,64);if(!$this->q('SELECT id FROM club_halls WHERE id=?',[$id])->fetch()){throw new ApiError(422,'invalid_hall');}$hallIds[]=$id;}
        $hallIds=array_values(array_unique($hallIds));sort($hallIds);
        $overrides=$data['overrides']??[];
        if(!is_array($overrides)||array_diff(array_keys($overrides),Permissions::ALL)||array_filter($overrides,fn($v)=>!is_bool($v))){throw new ApiError(422,'invalid_permissions');}
        if(in_array($role,['user','admin'],true)){$overrides=[];$hallIds=[];}
        return ['role'=>$role,'hallScope'=>$scope,'hallIds'=>$hallIds,'overrides'=>$overrides,'effectivePermissions'=>Permissions::effective($role,$overrides)];
    }
    public function updateUser(array $actor,array $data,int $now): array {
        Permissions::admin($actor);$id=$this->userId($data['userId']??null);$version=Rules::version($data['expectedVersion']??null);
        $status=Rules::choice($data['status']??null,['active','blocked']);$reason=Rules::text($data['reason']??null,500);
        return $this->repo->transaction($actor,function()use($actor,$data,$id,$version,$status,$reason,$now){
            $before=$this->user($id);$policy=$this->preview($data);
            if($before['version']!==$version){throw new ApiError(409,'version_conflict');}
            if($before['role']==='admin'&&$before['status']==='active'&&($policy['role']!=='admin'||$status!=='active')&&(int)$this->q("SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'")->fetchColumn()<=1){throw new ApiError(409,'last_active_admin');}
            $this->q('UPDATE users SET role=?,status=?,hall_scope=?,updated_at=?,version=version+1 WHERE id=?',[$policy['role'],$status,$policy['hallScope'],Rules::utc($now),$id]);
            $this->q('DELETE FROM club_trainer_halls WHERE user_id=?',[$id]);
            foreach($policy['hallIds'] as $hall){$this->q('INSERT INTO club_trainer_halls(user_id,hall_id,assigned_at) VALUES(?,?,?)',[$id,$hall,Rules::utc($now)]);}
            $this->q('DELETE FROM club_user_permissions WHERE user_id=?',[$id]);
            foreach($policy['overrides'] as $permission=>$allowed){$this->q('INSERT INTO club_user_permissions(user_id,permission,allowed) VALUES(?,?,?)',[$id,$permission,(int)$allowed]);}
            if($status==='blocked'){$this->q('UPDATE auth_sessions SET expires_at=LEAST(expires_at,?) WHERE user_id=?',[$now,$id]);}
            $this->q('UPDATE club_device_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',[$now,$id]);
            $after=$this->user($id);
            $fields=['role','status','hallScope','hallIds','overrides','effectivePermissions'];
            $this->repo->audit($actor,null,null,'user.access',(string)$id,['from'=>array_intersect_key($before,array_flip($fields)),'to'=>array_intersect_key($after,array_flip($fields)),'reason'=>$reason],$now);
            return ['user'=>$after];
        });
    }
    public function userId(mixed $value): int {
        if(is_string($value)&&preg_match('/^[1-9][0-9]{0,14}$/D',$value)){$value=(int)$value;}
        if(!is_int($value)||$value<1){throw new ApiError(422,'invalid_user');}return $value;
    }
    private function hallDto(array $row): array {
        return ['id'=>$row['id'],'name'=>$row['name'],'address'=>$row['address'],'active'=>(bool)$row['active'],'version'=>(int)$row['version'],
            'studentCount'=>(int)$this->q('SELECT COUNT(*) FROM club_students WHERE hall_id=? AND archived_at IS NULL',[$row['id']])->fetchColumn(),
            'trainerIds'=>array_map('intval',$this->q('SELECT user_id FROM club_trainer_halls WHERE hall_id=? ORDER BY user_id',[$row['id']])->fetchAll(\PDO::FETCH_COLUMN))];
    }
    public function halls(): array { return ['items'=>array_map(fn($r)=>$this->hallDto($r),$this->q('SELECT * FROM club_halls ORDER BY id')->fetchAll())]; }
    public function saveHall(array $actor,array $data,int $now): array {
        Permissions::admin($actor);$id=Rules::text($data['id']??null,64);
        if(!preg_match('/^[a-zA-Z0-9_-]+$/D',$id)){throw new ApiError(422,'invalid_hall');}
        $name=Rules::text($data['name']??null,200);$address=Rules::text($data['address']??null,300);$version=Rules::version($data['expectedVersion']??null);
        if(!is_bool($data['active']??null)){throw new ApiError(422,'invalid_fields');}$active=$data['active'];$reason=Rules::text($data['reason']??null,500);
        return $this->repo->transaction($actor,function()use($actor,$id,$name,$address,$version,$active,$reason,$now){
            $old=$this->q('SELECT * FROM club_halls WHERE id=? FOR UPDATE',[$id])->fetch();
            if((int)($old['version']??0)!==$version){throw new ApiError(409,'version_conflict');}
            if($old){$this->q('UPDATE club_halls SET name=?,address=?,active=?,version=version+1 WHERE id=?',[$name,$address,(int)$active,$id]);}
            else{$this->q('INSERT INTO club_halls(id,name,address,active) VALUES(?,?,?,?)',[$id,$name,$address,(int)$active]);}
            $this->repo->audit($actor,null,$id,'hall.saved',$id,['from'=>$old?:null,'to'=>['name'=>$name,'address'=>$address,'active'=>$active],'reason'=>$reason],$now);
            return ['hall'=>$this->hallDto($this->q('SELECT * FROM club_halls WHERE id=?',[$id])->fetch())];
        });
    }
    public function overview(int $now): array {
        $counts=$this->q("SELECT COUNT(*) students,COALESCE(SUM(learning_status='trial'),0) trial,COALESCE(SUM(learning_status='permanent'),0) permanent,COALESCE(SUM(learning_status='inactive'),0) inactive FROM club_students WHERE archived_at IS NULL")->fetch();
        $counts=array_map('intval',$counts);
        $counts['pending']=(int)$this->q("SELECT COUNT(*) FROM club_applications a JOIN club_students s ON s.id=a.student_id WHERE a.status='pending' AND s.archived_at IS NULL")->fetchColumn();
        $counts['unpaid']=(int)$this->q("SELECT COUNT(*) FROM club_students s LEFT JOIN club_payments p ON p.student_id=s.id AND p.month=? WHERE s.archived_at IS NULL AND s.admitted_at IS NOT NULL AND s.learning_status<>'inactive' AND COALESCE(p.status,'unpaid')='unpaid'",[Rules::month($now).'-01'])->fetchColumn();
        $counts['archived']=(int)$this->q('SELECT COUNT(*) FROM club_students WHERE archived_at IS NOT NULL')->fetchColumn();
        $counts['halls']=(int)$this->q('SELECT COUNT(*) FROM club_halls WHERE active=1')->fetchColumn();
        $counts['trainers']=(int)$this->q("SELECT COUNT(*) FROM users WHERE role IN ('trainer','head_trainer') AND status='active'")->fetchColumn();
        return ['counts'=>$counts,'events'=>array_map(fn($r)=>$this->auditDto($r),$this->q('SELECT a.*,u.first_name,u.last_name,u.middle_name,u.display_name FROM club_audit a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.id DESC LIMIT 10')->fetchAll())];
    }
    public function students(array $query,int $now): array {
        $archived=Rules::choice($query['archived']??'0',['0','1'])==='1';
        $where=[$archived?'s.archived_at IS NOT NULL':'s.archived_at IS NULL'];$args=[];$q=$this->search($query);
        if($q!==''){$where[]="CONCAT_WS(' ',s.last_name,s.first_name,s.middle_name) LIKE ?";$args[]='%'.$q.'%';}
        foreach(['hall'=>'s.hall_id','status'=>'s.learning_status'] as $key=>$column){if(($query[$key]??'')!==''){$where[]="$column=?";$args[]=Rules::text($query[$key],64);}}
        if(($query['payment']??'')!==''){$where[]="COALESCE(p.status,'unpaid')=?";$args[]=Rules::choice($query['payment'],['paid','unpaid']);}
        $this->dates($query,$archived?'s.archived_at':'s.created_at',$where,$args);
        $month=$query['month']??Rules::month($now);if(!is_string($month)||!preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/D',$month)){throw new ApiError(422,'invalid_month');}
        $result=$this->paged("SELECT s.*,COALESCE(p.status,'unpaid') payment_status,COALESCE(p.version,0) payment_version",'FROM club_students s LEFT JOIN club_payments p ON p.student_id=s.id AND p.month=?',$where,array_merge([$month.'-01'],$args),$this->page($query),'s.created_at DESC,s.id');
        $result['items']=array_map(fn($r)=>$this->repo->studentDto($r,$month,$now),$result['items']);return $result;
    }
    public function applications(array $query,int $now): array {
        $where=['s.archived_at IS NULL'];$args=[];$q=$this->search($query);
        if($q!==''){$where[]="CONCAT_WS(' ',s.last_name,s.first_name,s.middle_name,u.display_name,u.last_name,u.first_name) LIKE ?";$args[]='%'.$q.'%';}
        if(($query['hall']??'')!==''){$where[]='a.hall_id=?';$args[]=Rules::text($query['hall'],64);}
        if(($query['status']??'')!==''){$where[]='a.status=?';$args[]=Rules::choice($query['status'],['pending','accepted','rejected']);}
        $result=$this->paged('SELECT a.*,s.last_name,s.first_name,s.middle_name,s.age,s.birth_year,u.display_name,u.first_name parent_first_name,u.last_name parent_last_name,u.middle_name parent_middle_name',
            'FROM club_applications a JOIN club_students s ON s.id=a.student_id JOIN users u ON u.id=a.applicant_id',$where,$args,$this->page($query),'a.created_at DESC,a.id');
        $result['items']=array_map(fn($r)=>$this->repo->applicationDto($r,$now),$result['items']);return $result;
    }
    private function auditDto(array $r): array {
        return ['id'=>(int)$r['id'],'studentId'=>$r['student_id'],'hallId'=>$r['hall_id'],'actorId'=>$r['actor_user_id']===null?null:(int)$r['actor_user_id'],'actorName'=>$r['actor_user_id']===null?null:Profile::fullName($r),
            'action'=>$r['action'],'entityId'=>$r['entity_id'],'details'=>(object)json_decode($r['details_json'],true,32,JSON_THROW_ON_ERROR),'createdAt'=>Rules::iso($r['created_at'])];
    }
    public function audit(array $query): array {
        $where=[];$args=[];$q=$this->search($query);
        if($q!==''){$where[]="(a.action LIKE ? OR a.entity_id LIKE ? OR CAST(a.details_json AS CHAR) LIKE ? OR CONCAT_WS(' ',u.first_name,u.last_name,u.display_name) LIKE ?)";array_push($args,...array_fill(0,4,'%'.$q.'%'));}
        foreach(['action'=>'a.action','hall'=>'a.hall_id','studentId'=>'a.student_id'] as $key=>$column){if(($query[$key]??'')!==''){$where[]="$column=?";$args[]=Rules::text($query[$key],80);}}
        if(($query['actorId']??'')!==''){$where[]='a.actor_user_id=?';$args[]=$this->userId($query['actorId']);}
        if(($query['userId']??'')!==''){$where[]="a.entity_id=? AND a.action IN ('user.access','staff.role','staff.grant','staff.revoke')";$args[]=(string)$this->userId($query['userId']);}
        $this->dates($query,'a.created_at',$where,$args);$sort=Rules::choice($query['sort']??'desc',['asc','desc']);
        $result=$this->paged('SELECT a.*,u.first_name,u.last_name,u.middle_name,u.display_name','FROM club_audit a LEFT JOIN users u ON u.id=a.actor_user_id',$where,$args,$this->page($query),'a.id '.strtoupper($sort));
        $result['items']=array_map(fn($r)=>$this->auditDto($r),$result['items']);return $result;
    }
    public function deletePreview(array $actor,string $id,int $now): array {
        Permissions::admin($actor);$student=$this->repo->student($actor,$id);$related=[];
        foreach(['applications'=>'club_applications','payments'=>'club_payments','guardians'=>'club_student_guardians','audit'=>'club_audit'] as $key=>$table){$related[$key]=(int)$this->q("SELECT COUNT(*) FROM $table WHERE student_id=?",[$id])->fetchColumn();}
        return ['studentId'=>$id,'fullName'=>trim($student['last_name'].' '.$student['first_name'].' '.$student['middle_name']),'version'=>(int)$student['version'],'related'=>$related,
            'eligible'=>$student['archived_at']!==null,'limitation'=>$student['archived_at']===null?'Сначала архивируйте карточку.':'Перед удалением проверьте основания и обязательства хранения. При сомнении оставьте карточку в архиве.'];
    }
    public function deleteStudent(array $actor,array $data,int $now): array {
        Permissions::admin($actor);$id=Rules::id($data['studentId']??null);$version=Rules::version($data['expectedVersion']??null);
        $confirmation=Rules::text($data['confirmation']??null,250);Rules::text($data['reason']??null,500);
        $reasonCode=Rules::choice($data['reasonCode']??null,['subject_request','duplicate_record','retention_expired','other_reviewed']);
        if(($data['retentionReviewed']??null)!==true){throw new ApiError(422,'retention_review_required');}
        return $this->repo->transaction($actor,function()use($actor,$id,$version,$confirmation,$reasonCode,$now){
            $s=$this->repo->student($actor,$id,true);
            if((int)$s['version']!==$version){throw new ApiError(409,'version_conflict');}
            if($s['archived_at']===null){throw new ApiError(409,'archive_required');}
            if(!hash_equals(trim($s['last_name'].' '.$s['first_name'].' '.$s['middle_name']),$confirmation)){throw new ApiError(422,'confirmation_mismatch');}
            $preview=$this->deletePreview($actor,$id,$now);
            // Keep only an idempotency tombstone: an old retry must not recreate
            // erased child data. Other students from a shared batch survive.
            $this->q("UPDATE club_application_batches SET revoked_at=?,request_hash=REPEAT('0',64) WHERE id IN (SELECT batch_id FROM club_applications WHERE student_id=?)",[Rules::utc($now),$id]);
            $this->q('DELETE FROM club_applications WHERE student_id=?',[$id]);
            $this->q('DELETE FROM club_payments WHERE student_id=?',[$id]);
            $this->q('DELETE FROM club_student_guardians WHERE student_id=?',[$id]);
            // Preserve audit chronology, actor and action, remove free-form PII
            // and the FK before erasing the card. Parent accounts are untouched.
            $this->q("UPDATE club_audit SET student_id=NULL,details_json=JSON_OBJECT('redacted',TRUE) WHERE student_id=?",[$id]);
            $this->q('DELETE FROM club_students WHERE id=?',[$id]);
            $this->repo->audit($actor,null,null,'student.deleted',$id,['redacted'=>true,'reasonCode'=>$reasonCode,'related'=>$preview['related']],$now);
            return ['deleted'=>true,'studentId'=>$id];
        });
    }
}
