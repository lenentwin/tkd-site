<?php
declare(strict_types=1);
namespace Mft39;

interface Store
{
    public function session(string $hash): ?array;
    public function putSession(string $hash, array $data, ?string $oldHash): void;
    public function deleteSession(string $hash): void;
    public function consumeState(string $hash, string $state, int $now): string;
    public function user(string $id): ?array;
    public function upsertUser(string $yandexId): array;
    public function touch(string $hash, int $now): void;
    public function allow(string $bucket, int $now, int $limit): bool;
}

final class MysqlStore implements Store
{
    public function __construct(private \PDO $pdo) {}
    public function connection(): \PDO { return $this->pdo; }

    public static function connect(Config $config): self
    {
        $pdo = new \PDO('mysql:host=' . $config->get('DB_HOST') . ';port=' . $config->get('DB_PORT') . ';dbname=' . $config->get('DB_NAME') . ';charset=utf8mb4',
            $config->get('DB_USER'), $config->get('DB_PASSWORD'), [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_EMULATE_PREPARES => false,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC, \PDO::ATTR_TIMEOUT => 5,
            ]);
        $pdo->exec("SET time_zone = '+00:00'");
        return new self($pdo);
    }

    private function query(string $sql, array $args = []): \PDOStatement
    { $statement = $this->pdo->prepare($sql); $statement->execute($args); return $statement; }

    public function session(string $hash): ?array
    { return $this->query('SELECT * FROM auth_sessions WHERE token_hash = ?', [$hash])->fetch() ?: null; }

    public function putSession(string $hash, array $data, ?string $oldHash): void
    {
        $this->pdo->beginTransaction();
        try {
            if ($oldHash !== null) { $this->deleteSession($oldHash); }
            $this->query('INSERT INTO auth_sessions (token_hash,user_id,csrf_token,created_at,last_seen_at,expires_at,state_hash,code_verifier,state_expires_at) VALUES (?,?,?,?,?,?,?,?,?)', [
                $hash, $data['user_id'], $data['csrf_token'], $data['created_at'], $data['last_seen_at'], $data['expires_at'],
                $data['state_hash'] ?? null, $data['code_verifier'] ?? null, $data['state_expires_at'] ?? null,
            ]);
            $this->pdo->commit();
        } catch (\Throwable $error) { $this->pdo->rollBack(); throw $error; }
    }

    public function deleteSession(string $hash): void
    { $this->query('DELETE FROM auth_sessions WHERE token_hash = ?', [$hash]); }

    public function consumeState(string $hash, string $state, int $now): string
    {
        $this->pdo->beginTransaction();
        try {
            $row = $this->query('SELECT * FROM auth_sessions WHERE token_hash = ? FOR UPDATE', [$hash])->fetch();
            if (!$row || !is_string($row['state_hash']) || !hash_equals($row['state_hash'], tokenHash($state))) {
                throw new ApiError(400, 'invalid_state');
            }
            $this->query('UPDATE auth_sessions SET state_hash=NULL,code_verifier=NULL,state_expires_at=NULL WHERE token_hash=?', [$hash]);
            $this->pdo->commit(); // Consume BEFORE the network exchange, including failure paths.
            if ($now >= (int)$row['state_expires_at'] || $now >= (int)$row['expires_at']) { throw new ApiError(400, 'expired_state'); }
            return $row['code_verifier'];
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) { $this->pdo->rollBack(); }
            throw $error;
        }
    }

    public function user(string $id): ?array
    { return $this->query('SELECT id,role,status FROM users WHERE id=?', [$id])->fetch() ?: null; }

    public function upsertUser(string $yandexId): array
    {
        // UNIQUE serializes concurrent first registration. Existing roles/status
        // are never changed by the login request or by caller-supplied fields.
        $this->query("INSERT INTO users (yandex_user_id,role,status,created_at,updated_at) VALUES (?,'user','active',UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", [$yandexId]);
        $user = $this->query('SELECT id,role,status FROM users WHERE yandex_user_id=?', [$yandexId])->fetch();
        if ($user['status'] !== 'active') { throw new ApiError(403, 'account_blocked'); }
        $this->query("UPDATE users SET last_login_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=? AND status='active'", [$user['id']]);
        return $user;
    }

    public function touch(string $hash, int $now): void
    { $this->query('UPDATE auth_sessions SET last_seen_at=GREATEST(last_seen_at,?) WHERE token_hash=?', [$now, $hash]); }

    public function allow(string $bucket, int $now, int $limit): bool
    {
        $window = intdiv($now, 600) * 600;
        $this->query('INSERT INTO auth_rate_limits (bucket_hash,window_start,hits) VALUES (?,?,1) ON DUPLICATE KEY UPDATE hits=hits+1', [$bucket, $window]);
        return (int)$this->query('SELECT hits FROM auth_rate_limits WHERE bucket_hash=? AND window_start=?', [$bucket, $window])->fetchColumn() <= $limit;
    }

    public function cleanup(int $now): void
    {
        $this->query('DELETE FROM auth_sessions WHERE expires_at <= ?', [$now]);
        $this->query('DELETE FROM auth_rate_limits WHERE window_start < ?', [$now - 1200]);
    }
}
