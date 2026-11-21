<?php

date_default_timezone_set('Asia/Makassar');

// =========================================================
// 1. KONFIGURASI SESSION
// =========================================================

if (session_status() === PHP_SESSION_NONE) {

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');

    $isHttps = (
        isset($_SERVER['HTTPS']) &&
        $_SERVER['HTTPS'] !== '' &&
        strtolower((string) $_SERVER['HTTPS']) !== 'off'
    );

    session_name('SIPFAS_SESSION');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    if (!session_start()) {
        throw new RuntimeException(
            'Session SIPFAS gagal dimulai.'
        );
    }
}

// =========================================================
// 2. TOKEN CSRF (DIBUAT SETELAH SESSION AKTIF)
// =========================================================
// Token disimpan di $_SESSION dan dikirim ke browser lewat
// endpoint api/shared/csrf-token.php. Browser mengirimnya
// kembali pada header X-CSRF-Token (lihat assets/js/csrf.js).

if (
    empty($_SESSION['_csrf_token']) ||
    !is_string($_SESSION['_csrf_token'])
) {
    $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
}

// =========================================================
// 3. MEMUAT KONEKSI DATABASE
// =========================================================

require_once __DIR__ . '/koneksi.php';

// =========================================================
// 4. VALIDASI KONEKSI DATABASE
// =========================================================

if (!isset($pdo) || !($pdo instanceof PDO)) {
    throw new RuntimeException(
        'Koneksi database PDO SIPFAS tidak tersedia.'
    );
}
