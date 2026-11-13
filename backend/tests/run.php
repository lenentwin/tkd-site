<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
require __DIR__ . '/Fakes.php';
use Mft39\{App, Request, Yandex, ApiError};
use Mft39\Tests\{FakeHttp, FakeStore};
use function Mft39\Tests\{config, check, cookie};
use function Mft39\tokenHash;
$passed = 0; $failed = 0;
function test(string $name, callable $run): void {
    global $passed, $failed;
    try { $run(); $passed++; echo "PASS $name\n"; }
    catch (Throwable $e) { $failed++; echo "FAIL $name: " . $e->getMessage() . "\n"; }
}
function fixture(): array { $s = new FakeStore(); $h = new FakeHttp(); $c = config(); return [new App($c, $s, new Yandex($c, $h)), $s, $h]; }
function begin(App $app): array {
    $r = $app->handle(new Request('GET', '/auth/yandex/start', ip: '192.0.2.1'), 1000);
    parse_str(parse_url($r->headers['Location'], PHP_URL_QUERY), $q); return [cookie($r), $q, $r];
}
function finish(App $app, FakeHttp $http, string $sid, string $state, array $extra = []): \Mft39\Response {
    $http->replies = [['access_token' => 'fictional-token', 'token_type' => 'bearer', 'expires_in' => 3600, 'refresh_token' => 'discard-me'], ['id' => '100000001', 'client_id' => str_repeat('a', 32), 'default_email' => 'ignored@example.invalid']];
    return callback($app, $sid, array_replace(['state' => $state, 'code' => 'fictional-code'], $extra));
}
function callback(App $app, string $sid, array $query, int $time = 1001): \Mft39\Response {
    return $app->handle(new Request('GET', '/auth/yandex/callback', $query, cookies: ['__Host-mft39' => $sid]), $time);
}
function profile(App $app, string $sid, int $time = 1002, array $headers = []): \Mft39\Response {
    return $app->handle(new Request('GET', '/api/me', headers: $headers, cookies: ['__Host-mft39' => $sid]), $time);
}
test('first login, PKCE, cookie rotation, minimal profile, discarded tokens', function () {
    [$a, $s, $h] = fixture(); [$old, $q, $start] = begin($a); $row = $s->session(tokenHash($old));
    check($q['code_challenge_method'] === 'S256' && !isset($q['scope']));
    check($q['code_challenge'] === rtrim(strtr(base64_encode(hash('sha256', $row['code_verifier'], true)), '+/', '-_'), '='));
    $r = finish($a, $h, $old, $q['state']); $new = cookie($r);
    check($r->status === 302 && $r->headers['Location'] === 'https://mft39.ru/account');
    check($old !== $new && $s->session(tokenHash($old)) === null);
    check(str_contains($start->headers['Set-Cookie'], 'Path=/; Secure; HttpOnly; SameSite=Lax') && !str_contains($start->headers['Set-Cookie'], 'Domain='));
    check(profile($a, $new)->body['user'] === ['id' => 1, 'role' => 'user']);
    $stored = json_encode([$s->users, $s->sessions]);
    check(!str_contains($stored, 'fictional-token') && !str_contains($stored, 'discard-me') && !str_contains($stored, '@'));
    parse_str($h->calls[0][2], $body); check(isset($body['code_verifier']) && !isset($body['client_secret']));
});
test('repeat login, no duplicate, cannot raise role', function () {
    [$a, $s, $h] = fixture(); [$old, $q] = begin($a); finish($a, $h, $old, $q['state']);
    $s->users[1]['role'] = 'trainer'; [$old, $q] = begin($a);
    $r = finish($a, $h, $old, $q['state'], ['role' => 'head_trainer']);
    check(count($s->users) === 1 && profile($a, cookie($r))->body['user']['role'] === 'trainer');
});
test('anonymous profile polling in another tab preserves pending OAuth session', function () {
    [$a, $s, $h] = fixture(); [$sid, $q] = begin($a);
    $me = profile($a, $sid, 1000);
    check($me->status === 401 && !isset($me->headers['Set-Cookie']) && $s->session(tokenHash($sid)) !== null);
    check(finish($a, $h, $sid, $q['state'])->status === 302);
});
test('wrong state, wrong session, expired state', function () {
    [$a, , $h] = fixture(); [$sid, $q] = begin($a);
    check(callback($a, $sid, ['state' => str_repeat('x', 43), 'code' => 'x'])->body['error'] === 'invalid_state');
    check(callback($a, str_repeat('x', 43), ['state' => $q['state'], 'code' => 'x'])->status === 400);
    check(callback($a, $sid, ['state' => $q['state'], 'code' => 'x'], 1300)->body['error'] === 'expired_state'); check($h->calls === []);
});
test('callback replay cannot reuse state or code', function () {
    [$a, , $h] = fixture(); [$sid, $q] = begin($a); finish($a, $h, $sid, $q['state']); $count = count($h->calls);
    check(callback($a, $sid, ['state' => $q['state'], 'code' => 'fictional-code'])->status === 400 && count($h->calls) === $count);
});
test('user denial is sanitized and consumes state', function () {
    [$a, , $h] = fixture(); [$sid, $q] = begin($a);
    $r = callback($a, $sid, ['state' => $q['state'], 'error' => 'access_denied', 'error_description' => 'private-untrusted-text']);
    check($r->body['error'] === 'oauth_denied' && $h->calls === [] && !str_contains(json_encode($r), 'private-untrusted-text'));
    check(callback($a, $sid, ['state' => $q['state'], 'code' => 'x'])->body['error'] === 'invalid_state');
});
foreach (['unavailable', 'invalid_response', 'wrong_client', 'missing_id', 'expired_token', 'used_code'] as $scenario) {
    test('upstream failure: ' . $scenario, function () use ($scenario) {
        [$a, , $h] = fixture(); [$sid, $q] = begin($a); $token = ['access_token' => 'fixture', 'token_type' => 'bearer', 'expires_in' => 600];
        $h->replies = match ($scenario) {
            'unavailable' => [new ApiError(502, 'oauth_unavailable')], 'invalid_response' => [[]],
            'wrong_client' => [$token, ['id' => '1', 'client_id' => 'wrong']], 'missing_id' => [$token, ['login' => 'irrelevant']],
            'expired_token' => [array_replace($token, ['expires_in' => 0])], 'used_code' => [new ApiError(400, 'oauth_rejected')],
        };
        $r = callback($a, $sid, ['state' => $q['state'], 'code' => 'fixture']);
        check($r->status >= 400 && !isset($r->headers['Location']) && profile($a, $sid)->status === 401);
    });
}
test('anonymous profile, session fixation, frontend tokens rejected', function () {
    [$a] = fixture(); check(profile($a, str_repeat('x', 43))->status === 401);
    check($a->handle(new Request('GET', '/api/me', ['access_token' => 'untrusted', 'role' => 'head_trainer']), 1000)->status === 401);
});
test('CSRF requires exact origin plus token; logout invalidates session', function () {
    [$a, , $h] = fixture(); [$old, $q] = begin($a); $sid = cookie(finish($a, $h, $old, $q['state'])); $me = profile($a, $sid);
    foreach ([[], ['origin' => 'null'], ['origin' => 'https://mft39.ru'], ['origin' => 'https://evil.invalid', 'x-csrf-token' => $me->body['csrfToken']]] as $headers) {
        check($a->handle(new Request('POST', '/api/logout', headers: $headers, cookies: ['__Host-mft39' => $sid]), 1003)->status === 403);
    }
    $r = $a->handle(new Request('POST', '/api/logout', headers: ['origin' => 'https://mft39.ru', 'x-csrf-token' => $me->body['csrfToken']], cookies: ['__Host-mft39' => $sid]), 1003);
    check($r->status === 200 && str_contains($r->headers['Set-Cookie'], 'Max-Age=0') && profile($a, $sid)->status === 401);
});
test('CORS exact allowlist and preflight', function () {
    [$a] = fixture(); $r = profile($a, '', headers: ['origin' => 'https://mft39.ru']);
    check($r->status === 401 && $r->headers['Access-Control-Allow-Origin'] === 'https://mft39.ru' && $r->headers['Access-Control-Allow-Credentials'] === 'true');
    $r = profile($a, '', headers: ['origin' => 'https://evil.invalid']); check($r->status === 403 && !isset($r->headers['Access-Control-Allow-Origin']));
    $r = $a->handle(new Request('OPTIONS', '/api/logout', headers: ['origin' => 'https://mft39.ru', 'access-control-request-method' => 'POST', 'access-control-request-headers' => 'x-csrf-token']), 1000); check($r->status === 204);
    check($a->handle(new Request('OPTIONS', '/api/logout', headers: ['origin' => 'https://mft39.ru', 'access-control-request-method' => 'DELETE']), 1000)->status === 403);
});
test('absolute/idle expiry and blocked account revocation', function () {
    foreach (['absolute', 'idle', 'blocked'] as $scenario) {
        [$a, $s, $h] = fixture(); [$old, $q] = begin($a); $sid = cookie(finish($a, $h, $old, $q['state']));
        if ($scenario === 'blocked') { $s->users[1]['status'] = 'blocked'; }
        $time = match ($scenario) { 'absolute' => 29801, 'idle' => 2801, default => 1002 };
        check(profile($a, $sid, $time)->status === ($scenario === 'blocked' ? 403 : 401) && $s->session(tokenHash($sid)) === null);
    }
});
test('rate limits, HTTPS, allowed methods, no role endpoint', function () {
    [$a] = fixture(); for ($i=0; $i<20; $i++) { check($a->handle(new Request('GET', '/auth/yandex/start', ip: '192.0.2.2'), 1000)->status === 302); }
    check($a->handle(new Request('GET', '/auth/yandex/start', ip: '192.0.2.2'), 1000)->status === 429);
    check($a->handle(new Request('GET', '/api/me', https: false), 1000)->status === 400);
    check($a->handle(new Request('POST', '/api/me'), 1000)->status === 405);
    check($a->handle(new Request('POST', '/api/role'), 1000)->status === 404);
});
test('public files contain no config/fixtures and HTTP client rejects other endpoints', function () {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(dirname(__DIR__) . '/public', FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) { check($file->getExtension() === 'php'); $text = file_get_contents($file->getPathname());
        foreach (['YANDEX_CLIENT_SECRET', 'DB_PASSWORD', 'fictional-test', 'var_dump', 'print_r'] as $word) { check(!str_contains($text, $word)); }
    }
    try { (new \Mft39\CurlHttpClient())->json('http://untrusted.invalid', []); check(false); } catch (ApiError $e) { check($e->status === 502); }
});
echo "Tests: $passed passed, $failed failed\n"; exit($failed === 0 ? 0 : 1);
