
<?php
declare(strict_types=1);

/**
 * SIPFAS - PEMULIHAN AKUN
 * Lokasi: api/auth/pemulihan.php
 *
 * Fungsi:
 * 1. Menerima email dari halaman pemulihan.
 * 2. Memeriksa email pada tabel pengguna.
 * 3. Memastikan akun berstatus Aktif.
 * 4. Membuat sesi pemulihan di server.
 * 5. Menyiapkan sesi untuk verifikasi OTP.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Memastikan metode POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');

    jsonResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        405
    );
}

// Membatasi permintaan hanya JSON.
$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {
    jsonResponse(false, 'Gunakan format JSON.', 415);
}

// Membaca input JSON.
$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 2048) {
    jsonResponse(false, 'Data permintaan tidak valid.', 400);
}

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    jsonResponse(false, 'Format data tidak valid.', 400);
}

// Mengambil email.
$email = strtolower(
    trim((string)($input['email'] ?? ''))
);

// Validasi email.
if (
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($email) > 150
) {
    jsonResponse(false, 'Format email tidak valid.', 422);
}

// Memulai sesi dengan konfigurasi yang sama
// seperti endpoint verifikasi OTP SIPFAS.
if (session_status() === PHP_SESSION_NONE) {

    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS'])
            && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    session_start();
}

// Membersihkan sesi pemulihan sebelumnya.
unset(
    $_SESSION['pemulihan_id_pengguna'],
    $_SESSION['pemulihan_pending_expires'],
    $_SESSION['pemulihan_id_otp'],
    $_SESSION['pemulihan_terverifikasi'],
    $_SESSION['pemulihan_reset_berlaku_sampai']
);

try {

    // Memanggil koneksi database utama SIPFAS.
    require_once __DIR__ . '/../../config/koneksi.php';

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException(
            'Koneksi database tidak tersedia.'
        );
    }

    // Mencari pengguna berdasarkan email.
    $sql = "
        SELECT
            id_pengguna,
            nama_lengkap,
            email,
            status_akun
        FROM pengguna
        WHERE LOWER(email) = :email
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':email' => $email
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Memeriksa apakah email terdaftar.
    if (!$user) {
        jsonResponse(
            false,
            'Email tidak ditemukan dalam akun SIPFAS.',
            404
        );
    }

    // Memeriksa status akun.
    if (
        strcasecmp(
            trim((string)$user['status_akun']),
            'Aktif'
        ) !== 0
    ) {
        jsonResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            403
        );
    }

    // Mengganti ID sesi untuk keamanan.
    if (!session_regenerate_id(true)) {
        throw new RuntimeException(
            'Gagal membuat sesi pemulihan.'
        );
    }

    // Menyimpan identitas pengguna di sisi server.
    $_SESSION['pemulihan_id_pengguna'] =
        (string)$user['id_pengguna'];

    // Sesi pemulihan berlaku maksimal 10 menit.
    $_SESSION['pemulihan_pending_expires'] =
        time() + 600;

    // Respons untuk frontend.
    jsonResponse(
        true,
        'Email berhasil ditemukan. Lanjutkan ke verifikasi OTP.',
        200,
        [
            'masked_email' => maskEmail(
                (string)$user['email']
            ),
            'redirect' => 'verifikasi-otp-pemulihan.html'
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS PEMULIHAN] ' . $e->getMessage()
    );

    jsonResponse(
        false,
        'Terjadi kesalahan server. Silakan coba kembali.',
        500
    );
}


// ================================================
// FUNGSI RESPONS JSON
// ================================================

function jsonResponse(
    bool $success,
    string $message,
    int $status = 200,
    array $data = []
): never {

    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}


// ================================================
// MENYAMARKAN EMAIL
// ================================================

function maskEmail(string $email): string
{
    $parts = explode('@', $email, 2);

    if (count($parts) !== 2) {
        return '***';
    }

    $name = $parts[0];
    $domain = $parts[1];

    return substr($name, 0, 2)
        . str_repeat('*', max(3, strlen($name) - 2))
        . '@'
        . $domain;
}
