<?php

date_default_timezone_set('Asia/Makassar');

// =========================================================
// 2. KONFIGURASI SESSION
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
