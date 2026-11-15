
<?php

/**
 * SIPFAS - LOGIN
 * Database: sipfas
 * Koneksi: PDO
 * PHP: 8.4.27
 */

// Mengatur session sebelum menghasilkan output.
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_start();
}

// Mengatur format respons API dan mencegah caching.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Menyeragamkan respons JSON dari server.
function jsonResponse(bool $success, string $message, array $data = [], int $status = 200): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// Memastikan login hanya menggunakan metode POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    jsonResponse(false, 'Metode permintaan tidak diizinkan.', [], 405);
}

// Membaca data JSON atau form-data dari frontend.
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!is_array($input)) {
    $input = $_POST;
}

// Mengambil username/email, password, dan jenis pengguna.
$identifier = strtolower(trim((string)($input['identifier'] ?? $input['email'] ?? $input['username'] ?? '')));
$passwordInput = (string)($input['password'] ?? '');
$roleInput = strtolower(trim((string)($input['role'] ?? $input['jenisPengguna'] ?? '')));

// Memastikan seluruh input wajib sudah diisi.
if ($identifier === '' || $passwordInput === '' || $roleInput === '') {
    jsonResponse(false, 'Username/email, password, dan jenis pengguna wajib diisi.', [], 422);
}

// Membatasi panjang username/email.
if (strlen($identifier) > 150) {
    jsonResponse(false, 'Username atau email terlalu panjang.', [], 422);
}

// Membatasi ukuran password yang diterima server.
if (strlen($passwordInput) > 4096) {
    jsonResponse(false, 'Password tidak valid.', [], 422);
}

// Menyesuaikan nama role frontend dengan nama role database.
$roleMap = [
    'admin' => 'Administrator',
    'administrator' => 'Administrator',
    'petugas' => 'Petugas Sarpras',
    'petugas sarpras' => 'Petugas Sarpras',
    'pelapor' => 'Pelapor',
    'user' => 'Pelapor'
];

// Memastikan jenis pengguna termasuk role yang diizinkan.
if (!isset($roleMap[$roleInput])) {
    jsonResponse(false, 'Jenis pengguna tidak valid.', [], 422);
}

$role = $roleMap[$roleInput];

// Memanggil koneksi database PDO SIPFAS.
require_once __DIR__ . '/../../koneksi.php';

// Memastikan objek PDO tersedia.
if (!isset($pdo) || !($pdo instanceof PDO)) {
    error_log('[SIPFAS LOGIN] Koneksi PDO tidak tersedia.');
    jsonResponse(false, 'Koneksi database tidak tersedia.', [], 500);
}

try {
    // Mencari akun berdasarkan username/email dan jenis pengguna.
    $sql = "
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nama_pengguna,
            u.email,
            u.kata_sandi,
            u.status_akun,
            u.email_terverifikasi_pada,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE (
            u.email = :identifier_email
            OR u.nama_pengguna = :identifier_username
        )
        AND p.nama_peran = :role
        LIMIT 1
    ";

    // Menyiapkan dan menjalankan query menggunakan prepared statement.
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':identifier_email' => $identifier,
        ':identifier_username' => $identifier,
        ':role' => $role
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Memverifikasi password menggunakan hash yang tersimpan di database.
    if (!$user || !password_verify($passwordInput, (string)$user['kata_sandi'])) {
        jsonResponse(false, 'Username/email, password, atau jenis pengguna salah.', [], 401);
    }

    // Memastikan akun pengguna berstatus Aktif.
    if (strcasecmp(trim((string)$user['status_akun']), 'Aktif') !== 0) {
        jsonResponse(false, 'Akun Anda tidak aktif. Hubungi Administrator.', [], 403);
    }

    // Menghapus data autentikasi sebelumnya sebelum membuat session baru.
    unset(
        $_SESSION['id_pengguna'],
        $_SESSION['id_peran'],
        $_SESSION['nama_peran'],
        $_SESSION['nama_lengkap'],
        $_SESSION['sipfas_user'],
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires']
    );

    // Mengganti ID session untuk mencegah session fixation.
    session_regenerate_id(true);

    // Menyimpan identitas pengguna sementara untuk proses verifikasi OTP.
    $_SESSION['pending_login'] = [
        'id_pengguna' => (int)$user['id_pengguna'],
        'id_peran' => (int)$user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nama_peran' => $user['nama_peran']
    ];

    // Menentukan masa berlaku session OTP selama 5 menit.
    $_SESSION['pending_login_expires'] = time() + 300;

    // Menyamarkan alamat email untuk melindungi privasi pengguna.
    $emailParts = explode('@', (string)$user['email'], 2);
    $emailPrefix = $emailParts[0];
    $emailDomain = $emailParts[1] ?? '';

    $maskedEmail = substr($emailPrefix, 0, 2)
        . str_repeat('*', max(1, strlen($emailPrefix) - 2))
        . '@'
        . $emailDomain;

    // Mengirimkan respons keberhasilan dan instruksi menuju halaman OTP.
    jsonResponse(true, 'Kredensial berhasil diverifikasi. Silakan lanjutkan verifikasi OTP.', [
        'requires_otp' => true,
        'email' => $maskedEmail,
        'role' => $user['nama_peran'],
        'redirect' => 'verifikasi-otp.html'
    ], 200);

} catch (PDOException $e) {
    // Mencatat kesalahan database ke log server.
    error_log('[SIPFAS LOGIN PDO ERROR] ' . $e->getMessage());

    jsonResponse(false, 'Terjadi kesalahan database saat memproses login.', [], 500);

} catch (Throwable $e) {
    // Menangani kesalahan umum selama proses autentikasi.
    error_log('[SIPFAS LOGIN ERROR] ' . $e->getMessage());

    jsonResponse(false, 'Terjadi kesalahan pada server.', [], 500);
}
