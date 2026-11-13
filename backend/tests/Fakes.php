<?php
declare(strict_types=1);
namespace Mft39\Tests;
use Mft39\{Store, HttpClient, ApiError};
use function Mft39\tokenHash;

// Test doubles are outside public/ and are never loaded by production.
final class FakeHttp implements HttpClient
{
    public array $calls = [], $replies = [];
    public function json(string $url, array $headers, ?string $body = null): array
    {
        $this->calls[] = [$url, $headers, $body]; $reply = array_shift($this->replies);
        if ($reply instanceof \Throwable) { throw $reply; }
        if (!is_array($reply)) { throw new ApiError(502, 'oauth_unavailable'); }
        return $reply;
    }
}
final class FakeStore implements Store
{
    public array $sessions = [], $users = [], $rates = [];
    public function session(string $hash): ?array { return $this->sessions[$hash] ?? null; }
    public function putSession(string $hash, array $data, ?string $oldHash): void
    { if ($oldHash !== null) { unset($this->sessions[$oldHash]); } $this->sessions[$hash] = $data; }
    public function deleteSession(string $hash): void { unset($this->sessions[$hash]); }
    public function consumeState(string $hash, string $state, int $now): string
    {
        $r = $this->sessions[$hash] ?? null;
        if (!$r || !isset($r['state_hash']) || !hash_equals($r['state_hash'], tokenHash($state))) { throw new ApiError(400, 'invalid_state'); }
        unset($this->sessions[$hash]['state_hash'], $this->sessions[$hash]['code_verifier'], $this->sessions[$hash]['state_expires_at']);
        if ($now >= $r['state_expires_at'] || $now >= $r['expires_at']) { throw new ApiError(400, 'expired_state'); }
        return $r['code_verifier'];
    }
    public function user(string $id): ?array { return $this->users[$id] ?? null; }
    public function upsertUser(string $yandexId): array
    {
        foreach ($this->users as $u) { if ($u['yandex'] === $yandexId) {
            if ($u['status'] !== 'active') { throw new ApiError(403, 'account_blocked'); } return $u;
        } }
        $id = count($this->users) + 1;
        return $this->users[$id] = ['id' => $id, 'role' => 'user', 'status' => 'active', 'yandex' => $yandexId];
    }
    public function touch(string $hash, int $now): void { $this->sessions[$hash]['last_seen_at'] = $now; }
    public function allow(string $bucket, int $now, int $limit): bool
    { $key = $bucket . ':' . intdiv($now, 600); $this->rates[$key] = ($this->rates[$key] ?? 0) + 1; return $this->rates[$key] <= $limit; }
}
function config(): \Mft39\Config {
    return new \Mft39\Config(array_replace(require dirname(__DIR__) . '/config.example.php', [
        'YANDEX_CLIENT_ID' => str_repeat('a', 32), 'YANDEX_CLIENT_SECRET' => 'fictional-test-secret',
        'DB_NAME' => 'mft39_auth_test', 'DB_USER' => 'test', 'DB_PASSWORD' => 'fictional-test-password', 'RATE_LIMIT_KEY' => str_repeat('b', 64),
    ]));
}
function check(bool $ok, string $message = 'Assertion failed'): void { if (!$ok) { throw new \RuntimeException($message); } }
function cookie(\Mft39\Response $r): string { preg_match('/^__Host-mft39=([^;]+)/', $r->headers['Set-Cookie'] ?? '', $m); return $m[1] ?? ''; }
