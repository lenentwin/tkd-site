<?php
declare(strict_types=1);
require __DIR__ . '/mysql-bootstrap.php';
use Mft39\{App, Request, Yandex, ApiError};
use Mft39\Tests\FakeHttp;
use function Mft39\Tests\{check, config, cookie};
use function Mft39\tokenHash;
$sql = file_get_contents(dirname(__DIR__) . '/migrations/001_auth.sql');
foreach (explode(';', $sql) as $statement) { if (trim($statement) !== '') { $pdo->exec($statement); } }
$user = $store->upsertUser('999990002');
check($user['role'] === 'user' && $store->upsertUser('999990002')['id'] === $user['id']);
$pdo->exec("UPDATE users SET role='trainer' WHERE yandex_user_id='999990002'");
check($store->upsertUser('999990002')['role'] === 'trainer');
$pdo->exec("UPDATE users SET status='blocked' WHERE yandex_user_id='999990002'");
try { $store->upsertUser('999990002'); check(false); } catch (ApiError $e) { check($e->status === 403); }
echo "PASS real MySQL migration, repeat login, preserved role and blocked account\n";
function race(string $mode): array {
    $workers = [];
    for ($i=0; $i<8; $i++) { $pipes=[]; $p=proc_open([PHP_BINARY, __DIR__ . '/race-worker.php', $mode], [1=>['pipe','w'], 2=>['pipe','w']], $pipes); $workers[]=[$p,$pipes]; }
    $results=[];
    foreach ($workers as [$p,$pipes]) { $out=stream_get_contents($pipes[1]); $err=stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); check(proc_close($p) === 0 && $err === '', 'Worker failed'); $results[]=$out; }
    return $results;
}
$ids = race('register');
check(count(array_unique($ids)) === 1 && (int)$pdo->query("SELECT COUNT(*) FROM users WHERE yandex_user_id='999990001'")->fetchColumn() === 1);
echo "PASS 8 concurrent first registrations yield one real MySQL user\n";
$now=time(); $store->putSession(hash('sha256','test-session'), [
    'user_id'=>null,'csrf_token'=>str_repeat('x',43),'created_at'=>$now,'last_seen_at'=>$now,'expires_at'=>$now+300,
    'state_hash'=>tokenHash('test-state'),'code_verifier'=>str_repeat('y',86),'state_expires_at'=>$now+300,
], null);
$claims=race('consume'); check(count(array_filter($claims, fn($v)=>$v==='claimed'))===1 && count(array_filter($claims, fn($v)=>$v==='rejected'))===7);
echo "PASS concurrent callbacks: exactly one state claim in MySQL\n";

$http=new FakeHttp(); $app=new App(config(),$store,new Yandex(config(),$http));
$start=$app->handle(new Request('GET','/auth/yandex/start')); parse_str(parse_url($start->headers['Location'],PHP_URL_QUERY),$q); $old=cookie($start);
$http->replies=[['access_token'=>'fictional-ci-token','token_type'=>'bearer','expires_in'=>3600],['id'=>'999990003','client_id'=>str_repeat('a',32)]];
$done=$app->handle(new Request('GET','/auth/yandex/callback',['state'=>$q['state'],'code'=>'fictional'],cookies:['__Host-mft39'=>$old]));
$sid=cookie($done); check($done->status===302 && $store->session(tokenHash($old))===null);
$me=$app->handle(new Request('GET','/api/me',cookies:['__Host-mft39'=>$sid])); check($me->status===200 && $me->body['user']['role']==='user');
echo "PASS complete application flow with real DB and mocked Yandex only\n";

// Actual public entrypoint over local HTTP; the test router simulates TLS.
$socket=stream_socket_server('tcp://127.0.0.1:0',$errno,$error); $address=stream_socket_get_name($socket,false); fclose($socket);
$process=proc_open([PHP_BINARY,'-S',$address,__DIR__.'/http-router.php'],[1=>['file',sys_get_temp_dir().'/mft39-http-test.log','a'],2=>['file',sys_get_temp_dir().'/mft39-http-test.log','a']],$pipes,dirname(__DIR__,2));
try {
    $ready=false; for($i=0;$i<50;$i++){ $socket=@fsockopen('tcp://'.$address); if($socket){fclose($socket);$ready=true;break;} usleep(100000); } check($ready);
    $get=function(string $path,array $headers=[], bool $post=false)use($address):array {
        $h=curl_init('http://'.$address.$path); curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_HTTPHEADER=>$headers,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_TIMEOUT=>5]);
        if ($post) { curl_setopt($h, CURLOPT_POST, true); }
        $text=curl_exec($h); $status=curl_getinfo($h,CURLINFO_RESPONSE_CODE); curl_close($h); return [$status,$text];
    };
    [$status,$text]=$get('/health/index.php'); check($status===200 && str_contains($text,'"status":"ok"'));
    [$status,$text]=$get('/api/me/index.php',['Origin: https://mft39.ru']); check($status===401 && str_contains($text,'Access-Control-Allow-Credentials: true'));
    [$status,$text]=$get('/api/me/',['Cookie: __Host-mft39='.$sid,'Origin: https://mft39.ru']); check($status===200 && str_contains($text,'"authenticated":true'));
    [$status,$text]=$get('/api/me/',['Cookie: __Host-mft39='.$sid,'Origin: https://evil.invalid']); check($status===403 && !str_contains($text,'Access-Control-Allow-Origin'));
    [$status,$text]=$get('/auth/yandex/start/index.php'); check($status===302 && str_contains($text,'Secure; HttpOnly; SameSite=Lax') && !str_contains($text,'Domain='));
    [$status,$text]=$get('/auth/yandex/callback/index.php?state=bad&code=never-log-this'); check($status===400 && !str_contains($text,'never-log-this'));
    [$status,$text]=$get('/api/logout/',['Cookie: __Host-mft39='.$sid,'Origin: https://mft39.ru','X-CSRF-Token: '.$me->body['csrfToken']],true); check($status===200 && str_contains($text,'Max-Age=0'));
    [$status,$text]=$get('/api/me/',['Cookie: __Host-mft39='.$sid]); check($status===401);
    echo "PASS actual PHP entrypoints: health, profile, cookies, CORS, callback error\n";
} finally { proc_terminate($process); proc_close($process); }
check($store->session(tokenHash($sid))===null);
$store->cleanup(time()+86401); check((int)$pdo->query('SELECT COUNT(*) FROM auth_sessions')->fetchColumn()===0);
echo "PASS real DB logout and expiry cleanup\n";
