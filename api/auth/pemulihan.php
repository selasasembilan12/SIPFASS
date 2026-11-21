<?php
declare(strict_types=1);


// Memuat session utama dan koneksi PDO SIPFAS.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// Mengatur respons API.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Mengirim respons JSON.
function pemulihanResponse(
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

// Memastikan request menggunakan POST.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    pemulihanResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        405
    );
}

// Memastikan input menggunakan JSON.
$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {
    pemulihanResponse(
        false,
        'Gunakan format JSON.',
        415
    );
}

// Membaca input JSON.
$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 2048) {
    pemulihanResponse(
        false,
        'Data permintaan tidak valid.',
        400
    );
}

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    pemulihanResponse(
        false,
        'Format data tidak valid.',
        400
    );
}

// Memvalidasi email pengguna.
$email = strtolower(
    trim((string) ($input['email'] ?? ''))
);

if (
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($email) > 150
) {
    pemulihanResponse(
        false,
        'Format email tidak valid.',
        422
    );
}

try {

    // Mencari akun berdasarkan email.
    $stmt = $pdo->prepare("
        SELECT
            id_pengguna,
            nama_lengkap,
            email,
            status_akun
        FROM pengguna
        WHERE LOWER(email) = :email
        LIMIT 1
    ");

    $stmt->execute([
        ':email' => $email
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        pemulihanResponse(
            false,
            'Silahkan coba lagi!',
            404
        );
    }

    // Memastikan akun masih aktif.
    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {
        pemulihanResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            403
        );
    }

    // Membersihkan proses pemulihan sebelumnya.
    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_pending_expires'],
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    // Mengganti ID session untuk keamanan.
    if (!session_regenerate_id(true)) {
        throw new RuntimeException(
            'Gagal membuat session pemulihan.'
        );
    }

    // Menyimpan identitas pengguna di session server.
    $_SESSION['pemulihan_id_pengguna'] =
        (int) $user['id_pengguna'];

    // Session pemulihan berlaku selama 10 menit.
    $_SESSION['pemulihan_pending_expires'] =
        time() + 600;

    // Menyamarkan alamat email.
    $parts = explode('@', (string) $user['email'], 2);

    $prefix = $parts[0];
    $domain = $parts[1] ?? '';

    $maskedEmail =
        substr($prefix, 0, 2) .
        str_repeat('*', max(3, strlen($prefix) - 2)) .
        '@' . $domain;

    // Mengirim informasi ke halaman berikutnya.
    pemulihanResponse(
        true,
        'Email berhasil ditemukan. Silakan lanjutkan verifikasi OTP.',
        200,
        [
            'masked_email' => $maskedEmail,
            'redirect' => 'verifikasi-otp-pemulihan.html'
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS PEMULIHAN] ' .
        get_class($e) . ': ' . $e->getMessage()
    );

    pemulihanResponse(
        false,
        'Terjadi kesalahan server. Silakan coba kembali.',
        500
    );
}
