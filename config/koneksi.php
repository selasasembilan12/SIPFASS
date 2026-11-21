
<?php
// konfigurasi DB 
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'sipfas');
define('DB_USER', 'root');
define('DB_PASS', '');

// 2. MEMBUAT KONEKSI DATABASE

try {

    // Menentukan alamat koneksi database. (DATA SOURCE NAME)
    $dsn = 'mysql:host=' . DB_HOST .
           ';dbname=' . DB_NAME .
           ';charset=utf8mb4';

    // Membuat koneksi menggunakan PDO(PHP DATA OBJEK).
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
