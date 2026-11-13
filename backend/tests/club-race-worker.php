<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use Mft39\Club\{Repository,Rules};
$repo=new Repository($pdo);$actor=$store->user($argv[2]);$now=strtotime('2026-11-15T12:00:00Z');
try{
    if($argv[1]==='enroll'){
        $input=Rules::input(['students'=>[['lastName'=>'Параллельный','firstName'=>'Тест','middleName'=>'','age'=>25]],'locationId'=>'chelnokova','requestedDate'=>'2026-11-20','consent'=>true,'consentVersion'=>Rules::CONSENT_VERSION],$now);
        $result=$repo->enroll($actor,$input,'parallel-fixture-key',$now);echo $result['batchId'];
    }else{$result=$repo->payment($actor,$argv[3],'2026-12','paid',0,'','2026-12',strtotime('2026-11-30T22:00:00Z'));echo 'updated';}
}catch(\Mft39\ApiError $e){echo $e->status===409?'conflict':'error';}
