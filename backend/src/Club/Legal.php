<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

/** Server-owned legal versions. Drafts cannot become evidence of consent. */
final class Legal
{
    private array $documents;
    public function __construct(private Repository $repo,private bool $enforcement=false,?array $documents=null) {
        $this->documents=$documents??json_decode(file_get_contents(dirname(__DIR__,2).'/resources/legal-documents.json'),true,32,JSON_THROW_ON_ERROR);
        self::validateDocuments($this->documents);
    }
    public static function validateDocuments(array $documents): void {
        $types=[];
        foreach($documents as $d){
            if(!is_array($d)||!in_array($d['type']??null,['terms','privacy','user_consent','guardian_consent'],true)||in_array($d['type'],$types,true)
                ||!is_string($d['version']??null)||!preg_match('/^[A-Za-z0-9._-]{1,64}$/D',$d['version'])||!in_array($d['status']??null,['draft','approved'],true)
                ||!is_string($d['content']??null)||!is_string($d['title']??null)||!is_string($d['hash']??null)||!hash_equals(hash('sha256',$d['content']),$d['hash'])){throw new \RuntimeException('Invalid legal document bundle');}
            if($d['status']==='approved'&&(preg_match('/\[(?:УКАЗАТЬ|УТВЕРДИТЬ|ОФИЦИАЛЬНЫЙ)[^\]]*\]|предполагаем(?:ый|ая)|до утверждения|оператор должен проверить/iu',$d['content'])||stripos($d['version'],'draft')!==false)){throw new \RuntimeException('Incomplete legal approval');}
            $types[]=$d['type'];
        }
        if(count($types)!==4){throw new \RuntimeException('Four legal documents required');}
    }
    public function batchMarker(): string { return $this->enforcement?'legal-acceptance-refs-v1':Rules::CONSENT_VERSION; }
    public function validateGuardianInput(array $students): void {
        if(!$this->enforcement){return;}
        foreach($students as $student){if($student['age']<18||($student['birthYear']!==null&&$student['age']===18)){$this->proof($student['guardianConsent']??null,'guardian_consent');}}
    }
    public function document(string $type): array { foreach($this->documents as $d){if($d['type']===$type){return $d;}}throw new \LogicException('Unknown legal type'); }
    public function approved(): bool { return count(array_filter($this->documents,fn($d)=>$d['status']==='approved'))===4; }
    public function ready(): bool {
        return $this->repo->q("SHOW TABLES LIKE 'legal_schema_version'")->fetchColumn()==='legal_schema_version'
            &&(int)$this->repo->q('SELECT version FROM legal_schema_version WHERE id=1')->fetchColumn()===1;
    }
    public function status(array $actor): array {
        $ready=$this->ready();$accepted=[];
        if($ready){$accepted=array_map(fn($r)=>['type'=>$r['document_type'],'version'=>$r['document_version'],'hash'=>$r['document_hash'],'confirmedAt'=>Rules::iso($r['confirmed_at'])],$this->repo->q("SELECT document_type,document_version,document_hash,confirmed_at FROM legal_acceptances WHERE user_id=? AND subject_key='account' ORDER BY confirmed_at,id",[$actor['id']])->fetchAll());}
        $missing=[];foreach(['terms','user_consent'] as $type){$d=$this->document($type);if(!array_filter($accepted,fn($r)=>$r['type']===$type&&$r['version']===$d['version']&&$r['hash']===$d['hash'])){$missing[]=$type;}}
        return ['enforcement'=>$this->enforcement,'required'=>$this->enforcement&&($missing!==[]||!$this->approved()||!$ready),'canAccept'=>$ready&&$this->approved(),
            'documents'=>array_map(function($d){unset($d['content']);return $d;},$this->documents),'accepted'=>$accepted];
    }
    public function assertAccess(array $actor): void {
        if(!$this->enforcement){return;}
        if(!$this->approved()){throw new ApiError(403,'legal_documents_unavailable');}
        if(!$this->ready()){throw new ApiError(503,'legal_migration_required');}
        if($this->status($actor)['required']){throw new ApiError(403,'legal_required');}
    }
    public function proof(mixed $proof,string $type): array {
        $d=$this->document($type);
        if($d['status']!=='approved'){throw new ApiError(403,'legal_documents_unavailable');}
        if(!is_array($proof)||array_diff(array_keys($proof),['type','version','hash','accepted'])||($proof['type']??null)!==$type||($proof['accepted']??null)!==true
            ||($proof['version']??null)!==$d['version']||($proof['hash']??null)!==$d['hash']){throw new ApiError(422,$type==='guardian_consent'?'guardian_consent_required':'legal_confirmation_required');}
        return $d;
    }
    public function accept(array $actor,array $input,int $now): array {
        if($actor['native']??false){throw new ApiError(403,'legal_browser_required');}
        if(!$this->ready()){throw new ApiError(503,'legal_migration_required');}
        if(!$this->approved()){throw new ApiError(403,'legal_documents_unavailable');}
        if(array_diff(array_keys($input),['documents'])||!is_array($input['documents']??null)||!array_is_list($input['documents'])||count($input['documents'])<1||count($input['documents'])>2){throw new ApiError(422,'legal_confirmation_required');}
        $proofs=[];foreach($input['documents'] as $p){$type=is_array($p)?($p['type']??null):null;if(!in_array($type,['terms','user_consent'],true)||isset($proofs[$type])){throw new ApiError(422,'legal_confirmation_required');}$proofs[$type]=$this->proof($p,$type);}
        return $this->repo->transaction($actor,function()use($actor,$proofs,$now){
            foreach(['terms','user_consent'] as $type){$d=$this->document($type);if(!isset($proofs[$type])&&!$this->repo->q("SELECT id FROM legal_acceptances WHERE user_id=? AND document_type=? AND document_version=? AND document_hash=? AND subject_key='account'",[$actor['id'],$type,$d['version'],$d['hash']])->fetch()){throw new ApiError(422,'legal_confirmation_required');}}
            foreach($proofs as $d){$this->save($actor,$d,null,null,$now);}
            return $this->status($actor);
        },true);
    }
    public function guardian(array $actor,mixed $proof,int $now,string $application,string $student): void {
        if(!$this->enforcement){return;}$d=$this->proof($proof,'guardian_consent');$this->save($actor,$d,$application,$student,$now);
    }
    private function save(array $actor,array $document,?string $application,?string $student,int $now): void {
        // Locked authenticated user serializes duplicate confirmations. Time and
        // account are server-owned; never persist client-supplied identity/IP/UA.
        $exists=$this->repo->q('SELECT id FROM legal_acceptances WHERE user_id=? AND document_type=? AND document_version=? AND document_hash=? AND subject_key=?',[$actor['id'],$document['type'],$document['version'],$document['hash'],$application??'account'])->fetch();
        if($exists){return;}
        $this->repo->q('INSERT INTO legal_acceptances(id,user_id,document_type,document_version,document_hash,subject_key,application_id,student_id,confirmed_at) VALUES(?,?,?,?,?,?,?,?,?)',
            [Rules::uuid(),$actor['id'],$document['type'],$document['version'],$document['hash'],$application??'account',$application,$student,Rules::utc($now)]);
    }
}
