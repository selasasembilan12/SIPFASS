
<?php

/**
 * SIPFAS - KONEKSI DATABASE
 * Database: sipfas
 * Driver: PDO MySQL / MariaDB
 */

// Menentukan konfigurasi database.
if (!defined('DB_HOST')) define('DB_HOST', '127.0.0.1');
if (!defined('DB_NAME')) define('DB_NAME', 'sipfas');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');

try {
    // Membuat koneksi PDO ke MariaDB.
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

} catch (PDOException $e) {
    // Mencatat detail error tanpa menampilkan kredensial database.
    error_log('[SIPFAS DATABASE ERROR] ' . $e->getMessage());

    // Meneruskan error ke endpoint API agar dapat menghasilkan JSON.
    throw new RuntimeException('Koneksi database SIPFAS gagal.', 0, $e);
}
