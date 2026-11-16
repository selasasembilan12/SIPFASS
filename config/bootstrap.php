
<?php

/**
 * =========================================================
 * SIPFAS - APPLICATION BOOTSTRAP
 * =========================================================
 *
 * Fungsi:
 * 1. Menginisialisasi konfigurasi aplikasi.
 * 2. Mengatur zona waktu.
 * 3. Memuat koneksi database.
 * 4. Mengatur keamanan session.
 * 5. Memulai session pengguna.
 *
 * File ini menjadi fondasi seluruh backend SIPFAS.
 *
 * =========================================================
 */


// =========================================================
// 1. MEMUAT KONEKSI DATABASE
// =========================================================

// Memanggil koneksi database utama SIPFAS.
require_once __DIR__ . '/koneksi.php';


// =========================================================
// 2. PENGATURAN ZONA WAKTU
// =========================================================

// Menggunakan zona waktu WITA.
date_default_timezone_set('Asia/Makassar');


// =========================================================
// 3. KONFIGURASI KEAMANAN SESSION
// =========================================================

// Mengaktifkan strict mode untuk session.
ini_set('session.use_strict_mode', '1');

// Memastikan session hanya menggunakan cookie.
ini_set('session.use_only_cookies', '1');

// Memastikan session ID tidak dikirim melalui URL.
ini_set('session.use_trans_sid', '0');

// Memeriksa apakah aplikasi menggunakan HTTPS.
$isHttps = (
    isset($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== 'off'
);

// Mengatur nama session khusus SIPFAS.
session_name('SIPFAS_SESSION');

// Mengatur keamanan cookie session.
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);


// =========================================================
// 4. MEMULAI SESSION
// =========================================================

// Memulai session jika belum aktif.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
