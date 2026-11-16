
<?php
declare(strict_types=1);

/**
 * SIPFAS - PASSWORD BARU
 * Lokasi: api/auth/paswoard-baru.php
 *
 * Fungsi:
 * 1. Memastikan OTP sudah diverifikasi.
 * 2. Memeriksa masa berlaku sesi pemulihan.
 * 3. Memvalidasi password baru.
 * 4. Melakukan hashing password.
 * 5. Memperbarui password pada tabel pengguna.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Memastikan metode POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');

    passwordResponse(
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
    passwordResponse(
        false,
        'Gunakan format JSON.',
        415
    );
}

// Membaca input.
$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 8192) {
    passwordResponse(
        false,
        'Data permintaan tidak valid.',
        400
    );
}

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    passwordResponse(
        false,
        'Format data tidak valid.',
        400
    );
}

// Mendukung nama input dari JavaScript maupun HTML.
$password = (string)(
    $input['password']
    ?? $input['newPassword']
    ?? ''
);

$confirmation = (string)(
    $input['confirmation']
    ?? $input['confirmPassword']
    ?? ''
);

// Memulai sesi menggunakan cookie SIPFAS.
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

// Memeriksa hasil verifikasi OTP.
$isVerified =
    ($_SESSION['pemulihan_terverifikasi'] ?? false) === true;

$userId = (int)(
    $_SESSION['pemulihan_id_pengguna'] ?? 0
);

$resetExpiry = (int)(
    $_SESSION['pemulihan_reset_berlaku_sampai'] ?? 0
);

// Menolak permintaan tanpa verifikasi OTP.
if (
    !$isVerified ||
    $userId <= 0 ||
    $resetExpiry <= time()
) {

    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    passwordResponse(
        false,
        'Sesi verifikasi sudah berakhir. Silakan ulangi pemulihan akun.',
        401
    );
}

// Memvalidasi panjang password.
if (strlen($password) < 8 || strlen($password) > 72) {
    passwordResponse(
        false,
        'Password harus memiliki panjang 8 sampai 72 byte.',
        422
    );
}

// Memvalidasi huruf besar.
if (!preg_match('/[A-Z]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung huruf besar.',
        422
    );
}

// Memvalidasi huruf kecil.
if (!preg_match('/[a-z]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung huruf kecil.',
        422
    );
}

// Memvalidasi angka.
if (!preg_match('/[0-9]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung angka.',
        422
    );
}

// Memastikan konfirmasi password sama.
if (!hash_equals($password, $confirmation)) {
    passwordResponse(
        false,
        'Konfirmasi password tidak sesuai.',
        422
    );
}

try {

    // Memanggil koneksi database SIPFAS.
    require_once __DIR__ . '/../../config/koneksi.php';

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException(
            'Koneksi database tidak tersedia.'
        );
    }

    // Memastikan sesi masih terverifikasi di database.
    $pdo->beginTransaction();

    $check = $pdo->prepare("
        SELECT
            id_pengguna,
            status_akun
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
        FOR UPDATE
    ");

    $check->execute([
        ':id' => $userId
    ]);

    $user = $check->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $pdo->rollBack();

        passwordResponse(
            false,
            'Data pengguna tidak ditemukan.',
            404
        );
    }

    if (
        strcasecmp(
            trim((string)$user['status_akun']),
            'Aktif'
        ) !== 0
    ) {
        $pdo->rollBack();

        passwordResponse(
            false,
            'Akun tidak aktif.',
            403
        );
    }

    // Menghasilkan hash password baru.
    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {
        throw new RuntimeException(
            'Gagal membuat hash password.'
        );
    }

    // Memperbarui password pada tabel pengguna.
    $update = $pdo->prepare("
        UPDATE pengguna
        SET kata_sandi = :password
        WHERE id_pengguna = :id
    ");

    $update->execute([
        ':password' => $passwordHash,
        ':id' => $userId
    ]);

    // Mengakhiri transaksi.
    $pdo->commit();

    // Menghapus seluruh sesi pemulihan.
    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_pending_expires'],
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    // Mengganti ID sesi.
    session_regenerate_id(true);

    passwordResponse(
        true,
        'Password berhasil diperbarui. Silakan login kembali.',
        200
    );

} catch (Throwable $e) {

    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS PASSWORD BARU] ' . $e->getMessage()
    );

    passwordResponse(
        false,
        'Terjadi kesalahan server saat memperbarui password.',
        500
    );
}


// ================================================
// FUNGSI RESPONS JSON
// ================================================

function passwordResponse(
    bool $success,
    string $message,
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}
