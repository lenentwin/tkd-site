<?php
declare(strict_types=1);
namespace Mft39;

interface HttpClient
{
    public function json(string $url, array $headers, ?string $body = null): array;
}

final class CurlHttpClient implements HttpClient
{
    public function json(string $url, array $headers, ?string $body = null): array
    {
        if (!in_array($url, ['https://oauth.yandex.ru/token', 'https://login.yandex.ru/info?format=json'], true)) {
            throw new ApiError(502, 'oauth_unavailable');
        }
        $handle = curl_init($url);
        $buffer = '';
        curl_setopt_array($handle, [
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_WRITEFUNCTION => static function ($curl, string $data) use (&$buffer): int {
                if (strlen($buffer) + strlen($data) > 65536) { return 0; }
                $buffer .= $data;
                return strlen($data);
            },
        ]);
        if ($body !== null) { curl_setopt($handle, CURLOPT_POSTFIELDS, $body); }
        $success = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        // Never include transport diagnostics or response bodies in exceptions/logs.
        if ($success === false || $status >= 500 || $status === 429) { throw new ApiError(502, 'oauth_unavailable'); }
        if ($status !== 200) { throw new ApiError(400, 'oauth_rejected'); }
        try { $json = json_decode($buffer, true, 32, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new ApiError(502, 'oauth_invalid_response'); }
        if (!is_array($json) || array_is_list($json)) { throw new ApiError(502, 'oauth_invalid_response'); }
        return $json;
    }
}

final class Yandex
{
    public function __construct(private Config $config, private HttpClient $http) {}

    public function authorizeUrl(string $state, string $verifier): string
    {
        $query = [
            'response_type' => 'code', 'client_id' => $this->config->get('YANDEX_CLIENT_ID'),
            'redirect_uri' => $this->config->get('YANDEX_REDIRECT_URI'), 'state' => $state,
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ];
        if ($this->config->get('YANDEX_SCOPE') !== '') { $query['scope'] = $this->config->get('YANDEX_SCOPE'); }
        return 'https://oauth.yandex.ru/authorize?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    public function identify(string $code, string $verifier): string
    {
        $tokens = $this->http->json('https://oauth.yandex.ru/token', [
            'Content-Type: application/x-www-form-urlencoded', 'Accept: application/json',
            'Authorization: Basic ' . base64_encode($this->config->get('YANDEX_CLIENT_ID') . ':' . $this->config->get('YANDEX_CLIENT_SECRET')),
        ], http_build_query([
            'grant_type' => 'authorization_code', 'code' => $code, 'code_verifier' => $verifier,
            'redirect_uri' => $this->config->get('YANDEX_REDIRECT_URI'),
        ], '', '&', PHP_QUERY_RFC3986));
        $token = $tokens['access_token'] ?? null;
        if (!is_string($token) || !preg_match('/^[\x21-\x7e]{1,4096}$/D', $token)
            || !is_string($tokens['token_type'] ?? null) || strcasecmp($tokens['token_type'], 'bearer') !== 0
            || !is_int($tokens['expires_in'] ?? null) || $tokens['expires_in'] <= 0) {
            throw new ApiError(502, 'oauth_invalid_response');
        }
        $user = $this->http->json('https://login.yandex.ru/info?format=json', ['Accept: application/json', 'Authorization: OAuth ' . $token]);
        // Tokens and additional profile fields are never persisted or returned.
        unset($tokens, $token);
        if (array_key_exists('client_id', $user) && (!is_string($user['client_id']) || !hash_equals($this->config->get('YANDEX_CLIENT_ID'), $user['client_id']))) {
            throw new ApiError(502, 'oauth_invalid_response');
        }
        if (!is_string($user['id'] ?? null) || !preg_match('/^[0-9]{1,128}$/D', $user['id'])) {
            throw new ApiError(502, 'oauth_invalid_response');
        }
        return $user['id'];
    }
}
