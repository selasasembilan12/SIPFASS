<?php
declare(strict_types=1);



// =========================================================
// 01. MEMUAT KONFIGURASI DAN SERVICE
// =========================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';

// =========================================================
// 02. HEADER RESPONS
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// =========================================================
// 03. FUNGSI RESPONS JSON
// =========================================================

function otpPemulihanResponse(
    int $status,
    bool $success,
    string $message,
    array $data = []
): never {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message,
                'data' => $data
            ],
            $data
        ),
        JSON_UNESCAPED_UNICODE |
        JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

// =========================================================
// 04. MEMASTIKAN REQUEST POST
// =========================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    otpPemulihanResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// =========================================================
// 05. MEMASTIKAN FORMAT JSON
// =========================================================

$contentType = strtolower(
    trim(
        explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]
    )
);

if ($contentType !== 'application/json') {

    otpPemulihanResponse(
        415,
        false,
        'Gunakan format JSON.'
    );
}

$rawInput = file_get_contents('php://input');

if (
    $rawInput === false ||
    strlen($rawInput) > 2048
) {

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

// =========================================================
// 06. VALIDASI ACTION
// =========================================================

$action = $input['action'] ?? 'verify';

if (
    !is_string($action) ||
    !in_array(
        $action,
        ['ensure', 'resend', 'verify'],
        true
    )
) {

    otpPemulihanResponse(
        422,
        false,
        'Aksi permintaan tidak valid.'
    );
}

// =========================================================
// 07. VALIDASI FORMAT OTP
// =========================================================

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

// =========================================================
// 08. MEMERIKSA SESSION PEMULIHAN
// =========================================================

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

// =========================================================
// 09. PROSES UTAMA
// =========================================================

try {

    // -----------------------------------------------------
    // A. MENGAMBIL DATA PENGGUNA
    // -----------------------------------------------------

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
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        otpPemulihanResponse(
            403,
            false,
            'Akun tidak ditemukan atau tidak aktif.'
        );
    }

    // -----------------------------------------------------
    // B. MENYAMARKAN EMAIL
    // -----------------------------------------------------

    $parts = explode(
        '@',
        (string) $user['email'],
        2
    );

    $prefix = $parts[0];
    $domain = $parts[1] ?? '';

    $maskedEmail =
        substr($prefix, 0, 2) .
        str_repeat(
            '*',
            max(3, strlen($prefix) - 2)
        ) .
        '@' . $domain;

    // -----------------------------------------------------
    // C. MENGAMBIL OTP TERBARU
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // D. MEMERIKSA KEPEMILIKAN OTP
    // -----------------------------------------------------

    $sessionOtpId = (string) (
        $_SESSION['pemulihan_id_otp'] ?? ''
    );

    $owned = (
        $record &&
        (string) $record['id_otp'] === $sessionOtpId
    );

    // -----------------------------------------------------
    // E. MEMERIKSA STATUS OTP
    // -----------------------------------------------------

    $active = (
        $record &&
        $record['digunakan_pada'] === null &&
        $record['dibatalkan_pada'] === null &&
        (int) $record['expires_at'] > time() &&
        (int) $record['jumlah_percobaan'] < 3
    );

    // =====================================================
    // 10. ACTION ENSURE DAN RESEND
    // =====================================================

    if (
        $action === 'ensure' ||
        $action === 'resend'
    ) {

        // -------------------------------------------------
        // PERBAIKAN UTAMA:
        // OTP aktif tetapi session belum memiliki ID OTP.
        // -------------------------------------------------

        if ($active && !$owned) {

            // Mengikat OTP aktif dengan session pemulihan.
            $_SESSION['pemulihan_id_otp'] =
                (string) $record['id_otp'];

            otpPemulihanResponse(
                200,
                true,
                'Kode OTP tersedia. Silakan masukkan kode yang dikirim ke email Anda.',
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

        // -------------------------------------------------
        // OTP MASIH AKTIF DAN SUDAH TERIKAT SESSION
        // -------------------------------------------------

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

        // -------------------------------------------------
        // MEMBATASI PENGIRIMAN OTP
        // Maksimal 5 kali dalam 15 menit.
        // -------------------------------------------------

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM otp_verifikasi
            WHERE id_pengguna = :id
            AND tujuan = 'Pemulihan'
            AND tanggal_dibuat >=
                DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        ");

        $stmt->execute([
            ':id' => $userId
        ]);

        if ((int) $stmt->fetchColumn() >= 5) {

            otpPemulihanResponse(
                429,
                false,
                'Batas pengiriman OTP tercapai. Silakan coba kembali nanti.'
            );
        }

        // -------------------------------------------------
        // MEMBUAT OTP BARU
        // -------------------------------------------------

        $otp = OtpService::create(
            $pdo,
            $userId,
            'Pemulihan'
        );

        // -------------------------------------------------
        // MENGAMBIL ID OTP BARU
        // -------------------------------------------------

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

        // -------------------------------------------------
        // MENGIRIM OTP MELALUI EMAIL
        // -------------------------------------------------

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

            unset($_SESSION['pemulihan_id_otp']);

            otpPemulihanResponse(
                500,
                false,
                'Gagal mengirim OTP ke email. Silakan coba kembali.'
            );
        }

        // -------------------------------------------------
        // MENGIKAT OTP BARU KE SESSION
        // -------------------------------------------------

        $_SESSION['pemulihan_id_otp'] =
            (string) $newOtp['id_otp'];

        // -------------------------------------------------
        // RESPONS OTP BERHASIL DIKIRIM
        // -------------------------------------------------

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

    // =====================================================
    // 11. ACTION VERIFY
    // =====================================================

    // Memastikan OTP tersedia untuk session.
    if (!$owned || !$record) {

        otpPemulihanResponse(
            409,
            false,
            'Kode OTP tidak tersedia untuk sesi ini. Silakan muat ulang halaman.'
        );
    }

    // Memastikan OTP belum kedaluwarsa.
    if (!$active) {

        otpPemulihanResponse(
            410,
            false,
            'Kode OTP sudah kedaluwarsa atau tidak berlaku. Silakan kirim ulang kode.'
        );
    }

    // -----------------------------------------------------
    // A. MEMERIKSA KODE OTP
    // -----------------------------------------------------

    $valid = password_verify(
        $otpInput,
        (string) $record['kode_hash']
    );

    // -----------------------------------------------------
    // B. JIKA OTP SALAH
    // -----------------------------------------------------

    if (!$valid) {

        $attempts =
            (int) $record['jumlah_percobaan'] + 1;

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

        // -------------------------------------------------
        // JIKA 3 KALI SALAH, OTP DINONAKTIFKAN.
        // SESSION PEMULIHAN TETAP DIPERTAHANKAN.
        // -------------------------------------------------

        if ($attempts >= 3) {

            otpPemulihanResponse(
                429,
                false,
                'Batas percobaan OTP tercapai. Silakan kirim ulang kode untuk mendapatkan OTP baru.',
                [
                    'remaining_attempts' => 0,
                    'can_resend' => true
                ]
            );
        }

        otpPemulihanResponse(
            422,
            false,
            'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            [
                'remaining_attempts' => max(
                    0,
                    3 - $attempts
                )
            ]
        );
    }

    // -----------------------------------------------------
    // C. JIKA OTP BENAR
    // -----------------------------------------------------

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
            'Kode OTP sudah tidak berlaku. Silakan kirim ulang kode.'
        );
    }

    // -----------------------------------------------------
    // D. MEMPERBARUI SESSION
    // -----------------------------------------------------

    if (!session_regenerate_id(true)) {

        throw new RuntimeException(
            'Gagal memperbarui session.'
        );
    }

    // Mengaktifkan hak pembuatan password baru.
    $_SESSION['pemulihan_terverifikasi'] = true;

    // Masa berlaku sesi reset password 10 menit.
    $_SESSION['pemulihan_reset_berlaku_sampai'] =
        time() + 600;

    // Menghapus session sementara OTP.
    unset(
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_pending_expires']
    );

    // -----------------------------------------------------
    // E. RESPONS BERHASIL
    // -----------------------------------------------------

    otpPemulihanResponse(
        200,
        true,
        'Verifikasi OTP berhasil. Silakan buat kata sandi baru.',
        [
            'redirect' => 'password-baru.html'
        ]
    );

} catch (Throwable $e) {

    // Mencatat kesalahan pada log PHP.
    error_log(
        '[SIPFAS OTP PEMULIHAN] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    otpPemulihanResponse(
        500,
        false,
        'Terjadi kesalahan server saat memproses OTP.'
    );
}
