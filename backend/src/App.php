<?php
declare(strict_types=1);
namespace Mft39;

final class App
{
    public function __construct(private Config $config, private Store $store, private Yandex $yandex) {}

    public static function securityHeaders(): array
    {
        return ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache', 'Referrer-Policy' => 'no-referrer', 'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY', 'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            'Vary' => 'Origin', 'X-Robots-Tag' => 'noindex, nofollow'];
    }

    public function handle(Request $request, ?int $now = null): Response
    {
        $now ??= time();
        $response = new Response(headers: self::securityHeaders());
        try {
            if (!$request->https) { throw new ApiError(400, 'https_required'); }
            $origin = $request->headers['origin'] ?? null;
            if ($origin !== null && $origin !== $this->config->get('FRONTEND_URL')) { throw new ApiError(403, 'origin_not_allowed'); }
            if ($origin !== null) {
                $response->headers['Access-Control-Allow-Origin'] = $origin;
                $response->headers['Access-Control-Allow-Credentials'] = 'true';
            }
            $routes = ['/health' => 'GET', '/auth/yandex/start' => 'GET', '/auth/yandex/callback' => 'GET', '/api/me' => 'GET', '/api/logout' => 'POST'];
            if (!isset($routes[$request->path])) { throw new ApiError(404, 'not_found'); }
            if ($request->method === 'OPTIONS') {
                $askedMethod = $request->headers['access-control-request-method'] ?? '';
                $askedHeaders = array_filter(array_map('trim', explode(',', strtolower($request->headers['access-control-request-headers'] ?? ''))));
                if ($origin === null || $askedMethod !== $routes[$request->path] || array_diff($askedHeaders, ['content-type', 'x-csrf-token'])) { throw new ApiError(403, 'preflight_not_allowed'); }
                $response->status = 204;
                $response->headers['Access-Control-Allow-Methods'] = $askedMethod;
                $response->headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
                return $response;
            }
            if ($request->method !== $routes[$request->path]) {
                $response->headers['Allow'] = $routes[$request->path];
                throw new ApiError(405, 'method_not_allowed');
            }
            if ($request->path === '/health') { $response->body = ['status' => 'ok']; return $response; }
            $cookie = $request->cookies['__Host-mft39'] ?? '';
            $hash = is_string($cookie) && preg_match('/^[A-Za-z0-9_-]{43}$/D', $cookie) ? tokenHash($cookie) : null;

            if ($request->path === '/auth/yandex/start') {
                $this->rate($request, 'start', $now, 20);
                $state = randomToken(); $verifier = randomToken(64); $token = randomToken();
                $this->store->putSession(tokenHash($token), [
                    'user_id' => null, 'csrf_token' => randomToken(), 'created_at' => $now, 'last_seen_at' => $now,
                    'expires_at' => $now + $this->config->get('OAUTH_TTL'), 'state_hash' => tokenHash($state),
                    'code_verifier' => $verifier, 'state_expires_at' => $now + $this->config->get('OAUTH_TTL'),
                ], $hash);
                $response->cookie($token);
                $response->status = 302; $response->headers['Location'] = $this->yandex->authorizeUrl($state, $verifier);
                return $response;
            }
            if ($request->path === '/auth/yandex/callback') {
                $this->rate($request, 'callback', $now, 40);
                $state = $request->query['state'] ?? null;
                if ($hash === null || !is_string($state) || !preg_match('/^[A-Za-z0-9_-]{43}$/D', $state)) { throw new ApiError(400, 'invalid_state'); }
                $verifier = $this->store->consumeState($hash, $state, $now);
                if (isset($request->query['error'])) { throw new ApiError(400, 'oauth_denied'); }
                $code = $request->query['code'] ?? null;
                if (!is_string($code) || !preg_match('/^[\x21-\x7e]{1,2048}$/D', $code)) { throw new ApiError(400, 'invalid_code'); }
                $user = $this->store->upsertUser($this->yandex->identify($code, $verifier));
                $token = randomToken();
                $this->store->putSession(tokenHash($token), [
                    'user_id' => $user['id'], 'csrf_token' => randomToken(), 'created_at' => $now, 'last_seen_at' => $now,
                    'expires_at' => $now + $this->config->get('SESSION_TTL'),
                ], $hash);
                $response->cookie($token);
                $response->status = 302; $response->headers['Location'] = $this->config->get('FRONTEND_URL') . '/account';
                return $response;
            }
            $session = $hash === null ? null : $this->store->session($hash);
            if ($session === null || $session['user_id'] === null || $now >= (int)$session['expires_at']
                || $now - (int)$session['last_seen_at'] >= $this->config->get('SESSION_IDLE_TTL')) {
                if ($hash !== null) { $this->store->deleteSession($hash); }
                $response->cookie(null);
                throw new ApiError(401, 'unauthenticated');
            }
            $user = $this->store->user((string)$session['user_id']);
            if ($user === null || $user['status'] !== 'active') {
                $this->store->deleteSession($hash); $response->cookie(null);
                throw new ApiError(403, 'account_blocked');
            }
            if ($request->path === '/api/logout') {
                $csrf = $request->headers['x-csrf-token'] ?? null;
                if ($origin !== $this->config->get('FRONTEND_URL') || !is_string($csrf) || !hash_equals($session['csrf_token'], $csrf)) { throw new ApiError(403, 'csrf_failed'); }
                $this->store->deleteSession($hash); $response->cookie(null);
                $response->body = ['authenticated' => false]; return $response;
            }
            $this->store->touch($hash, $now);
            $response->body = ['authenticated' => true, 'user' => ['id' => (int)$user['id'], 'role' => $user['role']], 'csrfToken' => $session['csrf_token']];
        } catch (ApiError $error) {
            $response->status = $error->status;
            $response->body = ['authenticated' => false, 'error' => $error->error];
            if ($error->status === 429) { $response->headers['Retry-After'] = '600'; }
        }
        return $response;
    }

    private function rate(Request $request, string $purpose, int $now, int $limit): void
    {
        $key = hash_hmac('sha256', $purpose . ':' . $request->ip, $this->config->get('RATE_LIMIT_KEY'));
        if (!$this->store->allow($key, $now, $limit)) { throw new ApiError(429, 'rate_limited'); }
    }
}
