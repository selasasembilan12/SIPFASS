<?php
declare(strict_types=1);

/**
 * SIPFAS - PASSWORD BARU
 *
 * Memastikan OTP sudah diverifikasi sebelum pengguna
 * diperbolehkan memperbarui kata sandi.
 */

// Memuat session dan koneksi utama SIPFAS.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Mengatur respons API.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Mengirim respons JSON.
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

// Memastikan metode POST.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    passwordResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        405
    );
}

// Memastikan input JSON.
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

// Mengambil password dan konfirmasi.
$password = (string) (
    $input['password'] ??
    $input['newPassword'] ??
    ''
);

$confirmation = (string) (
    $input['confirmation'] ??
    $input['confirmPassword'] ??
    ''
);

// Memastikan pengguna sudah melewati verifikasi OTP.
$userId = (int) (
    $_SESSION['pemulihan_id_pengguna'] ?? 0
);

$isVerified = (
    ($_SESSION['pemulihan_terverifikasi'] ?? false) === true
);

$resetExpiry = (int) (
    $_SESSION['pemulihan_reset_berlaku_sampai'] ?? 0
);

if (
    !$isVerified ||
    $userId <= 0 ||
    $resetExpiry <= time()
) {
    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_pending_expires'],
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    passwordResponse(
        false,
        'Sesi pemulihan sudah berakhir. Silakan ulangi proses.',
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

// Memastikan password mengandung huruf besar.
if (!preg_match('/[A-Z]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung huruf besar.',
        422
    );
}

// Memastikan password mengandung huruf kecil.
if (!preg_match('/[a-z]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung huruf kecil.',
        422
    );
}

// Memastikan password mengandung angka.
if (!preg_match('/[0-9]/', $password)) {
    passwordResponse(
        false,
        'Password harus mengandung angka.',
        422
    );
}

// Memastikan konfirmasi password cocok.
if (!hash_equals($password, $confirmation)) {
    passwordResponse(
        false,
        'Konfirmasi password tidak sesuai.',
        422
    );
}

try {

    // Memastikan akun masih aktif.
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT
            id_pengguna,
            kata_sandi,
            status_akun
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

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
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {
        $pdo->rollBack();

        passwordResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            403
        );
    }

    // Mencegah pengguna menggunakan password lama kembali.
    if (
        password_verify(
            $password,
            (string) $user['kata_sandi']
        )
    ) {
        $pdo->rollBack();

        passwordResponse(
            false,
            'Password baru tidak boleh sama dengan password sebelumnya.',
            422
        );
    }

    // Mengamankan password menggunakan hashing.
    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {
        throw new RuntimeException(
            'Gagal membuat hash password.'
        );
    }

    // Memperbarui password pengguna.
    $update = $pdo->prepare("
        UPDATE pengguna
        SET kata_sandi = :password
        WHERE id_pengguna = :id
    ");

    $update->execute([
        ':password' => $passwordHash,
        ':id' => $userId
    ]);

    if ($update->rowCount() !== 1) {
        throw new RuntimeException(
            'Password gagal diperbarui.'
        );
    }

    // Menyelesaikan transaksi database.
    $pdo->commit();

    // Menghapus seluruh session pemulihan.
    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_pending_expires'],
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    // Mengganti ID session setelah proses selesai.
    session_regenerate_id(true);

    passwordResponse(
        true,
        'Password berhasil diperbarui. Silakan login menggunakan password baru.',
        200
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS PASSWORD BARU] ' .
        get_class($e) . ': ' . $e->getMessage()
    );

    passwordResponse(
        false,
        'Terjadi kesalahan server saat memperbarui password.',
        500
    );
}
