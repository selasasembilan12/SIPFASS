<?php
declare(strict_types=1);

/**
 * SIPFAS - VERIFIKASI OTP PEMULIHAN
 *
 * Action:
 * 1. ensure: Memastikan OTP tersedia.
 * 2. resend: Mengirim OTP baru.
 * 3. verify: Memeriksa OTP dan mengaktifkan sesi pembuatan password baru.
 */

// Memuat konfigurasi, session, database, dan service.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';

// Mengatur respons JSON.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Mengirim respons JSON.
function otpPemulihanResponse(
    int $status,
    bool $success,
    string $message,
    array $data = []
): never {
    http_response_code($status);

    echo json_encode(
        array_merge([
            'success' => $success,
            'message' => $message,
            'data' => $data
        ], $data),
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

// Memastikan metode request POST.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    otpPemulihanResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// Memastikan input JSON.
$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {
    otpPemulihanResponse(
        415,
        false,
        'Gunakan format JSON.'
    );
}

// Membaca data permintaan.
$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 2048) {
    otpPemulihanResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    otpPemulihanResponse(
        400,
        false,
        'Format data tidak valid.'
    );
}

// Memeriksa action.
$action = $input['action'] ?? 'verify';

if (!in_array($action, ['ensure', 'resend', 'verify'], true)) {
    otpPemulihanResponse(
        422,
        false,
        'Aksi tidak valid.'
    );
}

// Memvalidasi format OTP.
$otpInput = $input['otp'] ?? '';

if (
    $action === 'verify' &&
    (
        !is_string($otpInput) ||
        !preg_match('/^[0-9]{8}$/D', $otpInput)
    )
) {
    otpPemulihanResponse(
        422,
        false,
        'Masukkan kode OTP delapan digit.'
    );
}

// Mengambil identitas dari session server.
$userId = (int) (
    $_SESSION['pemulihan_id_pengguna'] ?? 0
);

$pendingExpiry = (int) (
    $_SESSION['pemulihan_pending_expires'] ?? 0
);

if (
    $userId <= 0 ||
    $pendingExpiry <= time() ||
    ($_SESSION['pemulihan_terverifikasi'] ?? false) === true
) {
    unset(
        $_SESSION['pemulihan_id_pengguna'],
        $_SESSION['pemulihan_pending_expires'],
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_terverifikasi'],
        $_SESSION['pemulihan_reset_berlaku_sampai']
    );

    otpPemulihanResponse(
        401,
        false,
        'Sesi pemulihan tidak berlaku. Silakan ulangi pemulihan akun.'
    );
}

try {

    // Mengambil data pengguna terbaru.
    $stmt = $pdo->prepare("
        SELECT
            id_pengguna,
            email,
            status_akun
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$user ||
        strcasecmp(trim((string) $user['status_akun']), 'Aktif') !== 0
    ) {
        otpPemulihanResponse(
            403,
            false,
'Permintaan tidak dapat diproses. Silakan ulangi proses pemulihan akun.'        );
    }

    // Menyamarkan email pengguna.
    $parts = explode('@', (string) $user['email'], 2);

    $maskedEmail =
        substr($parts[0], 0, 2) .
        str_repeat('*', max(3, strlen($parts[0]) - 2)) .
        '@' . ($parts[1] ?? '');

    // Mengambil OTP terbaru untuk sesi ini.
    $stmt = $pdo->prepare("
        SELECT
            id_otp,
            kode_hash,
            jumlah_percobaan,
            berlaku_sampai,
            digunakan_pada,
            dibatalkan_pada,
            UNIX_TIMESTAMP(berlaku_sampai) AS expires_at
        FROM otp_verifikasi
        WHERE id_pengguna = :id
        AND tujuan = 'Pemulihan'
        ORDER BY id_otp DESC
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    $sessionOtpId = (string) (
        $_SESSION['pemulihan_id_otp'] ?? ''
    );

    $owned = (
        $record &&
        (string) $record['id_otp'] === $sessionOtpId
    );

    $active = (
        $record &&
        $record['digunakan_pada'] === null &&
        $record['dibatalkan_pada'] === null &&
        (int) $record['expires_at'] > time() &&
        (int) $record['jumlah_percobaan'] < 3
    );

    // Memastikan OTP tersedia.
    if ($action === 'ensure' || $action === 'resend') {

        if ($active && $owned) {
            otpPemulihanResponse(
                200,
                true,
                'Kode OTP masih berlaku.',
                [
                    'expires_at' => (int) $record['expires_at'],
                    'masked_email' => $maskedEmail,
                    'remaining_attempts' => max(
                        0,
                        3 - (int) $record['jumlah_percobaan']
                    )
                ]
            );
        }

        // Jika OTP aktif berasal dari sesi lain, jangan
        // langsung menggantinya sebelum masa berlakunya habis.
        if ($active && !$owned) {
            otpPemulihanResponse(
                409,
                false,
                'Kode OTP sebelumnya masih aktif. Silakan tunggu hingga kedaluwarsa.'
            );
        }

        // Membatasi maksimal 5 pengiriman dalam 15 menit.
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM otp_verifikasi
            WHERE id_pengguna = :id
            AND tujuan = 'Pemulihan'
            AND tanggal_dibuat >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        ");

        $stmt->execute([
            ':id' => $userId
        ]);

        if ((int) $stmt->fetchColumn() >= 5) {
            otpPemulihanResponse(
                429,
                false,
                'Batas pengiriman OTP tercapai. Silakan coba lagi nanti.'
            );
        }

        // Membuat OTP melalui service utama SIPFAS.
        $otp = OtpService::create(
            $pdo,
            $userId,
            'Pemulihan'
        );

        // Mengambil ID OTP terbaru.
        $stmt = $pdo->prepare("
            SELECT
                id_otp,
                UNIX_TIMESTAMP(berlaku_sampai) AS expires_at
            FROM otp_verifikasi
            WHERE id_pengguna = :id
            AND tujuan = 'Pemulihan'
            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL
            ORDER BY id_otp DESC
            LIMIT 1
        ");

        $stmt->execute([
            ':id' => $userId
        ]);

        $newOtp = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$newOtp) {
            throw new RuntimeException(
                'OTP baru tidak ditemukan.'
            );
        }

        // Mengirim OTP melalui MailService utama.
        $emailSent = MailService::sendOtp(
            (string) $user['email'],
            $otp,
            'Pemulihan'
        );

        if (!$emailSent) {
            OtpService::cancel(
                $pdo,
                $userId,
                'Pemulihan'
            );

            otpPemulihanResponse(
                500,
                false,
                'Gagal mengirim OTP ke email. Silakan coba kembali.'
            );
        }

        // Mengikat OTP terbaru dengan session.
        $_SESSION['pemulihan_id_otp'] =
            (string) $newOtp['id_otp'];

        otpPemulihanResponse(
            200,
            true,
            'Kode OTP berhasil dikirim ke email Anda.',
            [
                'expires_at' => (int) $newOtp['expires_at'],
                'masked_email' => $maskedEmail,
                'remaining_attempts' => 3
            ]
        );
    }

    // Memastikan OTP berasal dari session pengguna.
    if (!$owned || !$record) {
        otpPemulihanResponse(
            409,
            false,
            'Kode OTP tidak tersedia untuk sesi ini.'
        );
    }

    // Memastikan OTP belum kedaluwarsa.
    if (!$active) {
        otpPemulihanResponse(
            410,
            false,
            'Kode OTP kedaluwarsa atau tidak berlaku.'
        );
    }

    // Memeriksa kode OTP.
    $valid = password_verify(
        $otpInput,
        (string) $record['kode_hash']
    );

    if (!$valid) {

        $attempts = (int) $record['jumlah_percobaan'] + 1;

        $stmt = $pdo->prepare("
            UPDATE otp_verifikasi
            SET
                jumlah_percobaan = :jumlah,
                dibatalkan_pada = CASE
                    WHEN :jumlah2 >= 3 THEN NOW()
                    ELSE dibatalkan_pada
                END
            WHERE id_otp = :id
            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL
        ");

        $stmt->execute([
            ':jumlah' => $attempts,
            ':jumlah2' => $attempts,
            ':id' => $record['id_otp']
        ]);

        otpPemulihanResponse(
            $attempts >= 3 ? 429 : 422,
            false,
            $attempts >= 3
                ? 'Batas percobaan OTP tercapai. Silakan kirim ulang kode.'
                : 'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            [
                'remaining_attempts' => max(0, 3 - $attempts)
            ]
        );
    }

    // Menandai OTP berhasil digunakan.
    $stmt = $pdo->prepare("
        UPDATE otp_verifikasi
        SET digunakan_pada = NOW()
        WHERE id_otp = :id
        AND digunakan_pada IS NULL
        AND dibatalkan_pada IS NULL
        AND berlaku_sampai > NOW()
        AND jumlah_percobaan < 3
    ");

    $stmt->execute([
        ':id' => $record['id_otp']
    ]);

    if ($stmt->rowCount() !== 1) {
        otpPemulihanResponse(
            410,
            false,
            'Kode OTP sudah tidak berlaku.'
        );
    }

    // Memperbarui ID session setelah verifikasi.
    if (!session_regenerate_id(true)) {
        throw new RuntimeException(
            'Gagal memperbarui session.'
        );
    }

    // Mengaktifkan hak pembuatan password baru.
    $_SESSION['pemulihan_terverifikasi'] = true;

    $_SESSION['pemulihan_reset_berlaku_sampai'] =
        time() + 600;

    // Menghapus session sementara OTP.
    unset(
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_pending_expires']
    );

    // Mengarahkan pengguna ke halaman password baru.
    otpPemulihanResponse(
        200,
        true,
        'Verifikasi OTP berhasil. Silakan buat kata sandi baru.',
        [
            'redirect' => 'password-baru.html'
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS OTP PEMULIHAN] ' .
        get_class($e) . ': ' . $e->getMessage()
    );

    otpPemulihanResponse(
        500,
        false,
        'Terjadi kesalahan server saat memproses OTP.'
    );
}
