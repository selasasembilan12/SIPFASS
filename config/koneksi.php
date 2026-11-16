
<?php

/**
 * =========================================================
 * SIPFAS - DATABASE CONNECTION
 * =========================================================
 *
 * Fungsi:
 * 1. Menentukan konfigurasi database.
 * 2. Membuat koneksi PHP dengan MySQL.
 * 3. Menggunakan PDO sebagai metode koneksi.
 * 4. Menyediakan koneksi database untuk seluruh aplikasi.
 *
 * =========================================================
 */


// =========================================================
// 1. KONFIGURASI DATABASE
// =========================================================

// Menentukan alamat server database.
define('DB_HOST', '127.0.0.1');

// Menentukan nama database SIPFAS.
define('DB_NAME', 'sipfas');

// Menentukan username database.
define('DB_USER', 'root');

// Password database XAMPP (default kosong).
define('DB_PASS', '');


// =========================================================
// 2. MEMBUAT KONEKSI DATABASE
// =========================================================

try {

    // Menentukan alamat koneksi database.
    $dsn = 'mysql:host=' . DB_HOST .
           ';dbname=' . DB_NAME .
           ';charset=utf8mb4';

    // Membuat koneksi menggunakan PDO.
    $pdo = new PDO(
        $dsn,
        DB_USER,
        DB_PASS,
        [
            // Mengaktifkan penanganan error.
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,

            // Mengatur hasil query menjadi associative array.
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,

            // Menggunakan prepared statement native.
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

} catch (PDOException $e) {

    // Mencatat detail kesalahan ke log server.
    error_log('SIPFAS Database Error: ' . $e->getMessage());

    // Menghentikan proses jika koneksi gagal.
    http_response_code(500);

    exit('Koneksi database gagal.');

}
