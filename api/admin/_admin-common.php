<?php
declare(strict_types=1);

/**
 * SIPFAS - ADMIN API COMMON
 * Helper bersama untuk seluruh endpoint Administrator.
 */
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/role-check.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

sipfas_require_role([SIPFAS_ROLE_ADMIN]);

function admin_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function admin_ok(string $message, $data = null, int $status = 200): never
{
    admin_json(['success' => true, 'message' => $message, 'data' => $data], $status);
}
function admin_fail(string $message, int $status = 400, $errors = null): never
{
    admin_json(['success' => false, 'message' => $message, 'data' => null, 'errors' => $errors], $status);
}
function admin_input(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '', true);
    return is_array($json) ? $json : $_POST;
}
function admin_method(string ...$allowed): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, $allowed, true)) admin_fail('Metode request tidak diizinkan.', 405);
    return $method;
}
function admin_user_id(): int
{
    $user = sipfas_session_user();
    return (int)($user['id_pengguna'] ?? 0);
}
function admin_id(array $input, string $key = 'id'): int
{
    $id = filter_var($input[$key] ?? $_GET[$key] ?? null, FILTER_VALIDATE_INT);
    if (!$id || $id < 1) admin_fail('ID data tidak valid.', 422);
    return (int)$id;
}
function admin_text(array $input, string $key, int $max, bool $required = true): ?string
{
    $value = trim((string)($input[$key] ?? ''));
    if ($required && $value === '') admin_fail("Kolom {$key} wajib diisi.", 422);
    if ($value === '') return null;
    if (mb_strlen($value) > $max) admin_fail("Kolom {$key} maksimal {$max} karakter.", 422);
    return $value;
}
function admin_page(): array
{
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    return [$page, $limit, ($page - 1) * $limit];
}
function admin_transaction(callable $callback)
{
    global $pdo;
    try {
        $pdo->beginTransaction();
        $result = $callback($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
function admin_exception(Throwable $e): never
{
    error_log('[SIPFAS ADMIN API] ' . $e->getMessage());
    admin_fail('Terjadi kesalahan pada server. Periksa log PHP untuk detail.', 500);
}
