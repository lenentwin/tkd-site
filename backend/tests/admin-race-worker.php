<?php
declare(strict_types=1);
require __DIR__.'/mysql-bootstrap.php';
use Mft39\Club\{Repository,Admin};
$repo=new Repository($pdo);$user=$store->user($argv[1]);$actor=array_merge($user,$repo->authority($user));$admin=new Admin($repo);
try{$admin->updateUser($actor,['userId'=>(int)$user['id'],'role'=>'user','status'=>'active','hallScope'=>'assigned','hallIds'=>[],'overrides'=>[],'expectedVersion'=>(int)$user['version'],'reason'=>'Synthetic concurrent test'],time());echo 'updated';}
catch(\Mft39\ApiError $e){echo $e->error;}
