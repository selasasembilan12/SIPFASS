<?php
declare(strict_types=1);

/**
 * SIPFAS - ENDPOINT TOKEN CSRF
 *
 * Mengembalikan token CSRF milik session saat ini.
 * Dipanggil otomatis oleh assets/js/csrf.js.
 * Boleh diakses sebelum login (untuk halaman login/registrasi).
 */

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/csrf.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Metode request tidak diizinkan.',
        'data' => null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Token CSRF berhasil dibuat.',
    'data' => ['csrf_token' => sipfas_csrf_token()]
], JSON_UNESCAPED_UNICODE);
