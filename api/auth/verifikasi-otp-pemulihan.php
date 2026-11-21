<?php
declare(strict_types=1);

// =========================================================
// 01. MEMUAT KONFIGURASI DAN SERVICE
// =========================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

// =========================================================
// 02. HEADER RESPONS
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

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
// 04. MENGAMBIL OTP TERBARU
// =========================================================

function otpPemulihanAmbilRecord(
    PDO $pdo,
    int $userId
): ?array {

    $stmt = $pdo->prepare("
        SELECT
            id_otp,
            id_pengguna,
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

    return $record ?: null;
}

// =========================================================
// 05. MEMERIKSA STATUS OTP
// =========================================================

function otpPemulihanAktif(?array $record): bool
{
    if (!$record) {
        return false;
    }

    return (
        $record['digunakan_pada'] === null &&
        $record['dibatalkan_pada'] === null &&
        (int) $record['expires_at'] > time() &&
        (int) $record['jumlah_percobaan'] < 3
    );
}

// =========================================================
// 06. MEMERIKSA METODE REQUEST
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
// 07. MEMERIKSA FORMAT JSON
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
// 08. VALIDASI ACTION
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
// 09. VALIDASI FORMAT OTP
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
// 10. MEMERIKSA SESSION PEMULIHAN
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
// 11. PROSES UTAMA
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

    if (!$user) {

        otpPemulihanResponse(
            403,
            false,
            'Akun tidak ditemukan atau tidak aktif.'
        );
    }

    if (
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

    $prefix = $parts[0] ?? '';
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

    $record = otpPemulihanAmbilRecord(
        $pdo,
        $userId
    );

    $sessionOtpId = (string) (
        $_SESSION['pemulihan_id_otp'] ?? ''
    );

    $owned = (
        $record !== null &&
        (string) $record['id_otp'] === $sessionOtpId
    );

    $active = otpPemulihanAktif($record);

    // =====================================================
    // 12. ACTION ENSURE DAN RESEND
    // =====================================================

    if (
        $action === 'ensure' ||
        $action === 'resend'
    ) {

        // -------------------------------------------------
        // A. MENGUNCI PROSES PENERBITAN OTP
        // -------------------------------------------------

        // Mencegah beberapa request bersamaan membuat
        // OTP baru untuk pengguna yang sama.

        $lockName = 'sipfas_otp_pemulihan_' . $userId;

        $lockStmt = $pdo->prepare("
            SELECT GET_LOCK(:lock_name, 5)
        ");

        $lockStmt->execute([
            ':lock_name' => $lockName
        ]);

        $lockAcquired = (int) $lockStmt->fetchColumn() === 1;

        if (!$lockAcquired) {

            otpPemulihanResponse(
                429,
                false,
                'Permintaan OTP sedang diproses. Silakan coba kembali.'
            );
        }

        $issueResponse = null;

        try {

            // -------------------------------------------------
            // B. MEMBACA ULANG OTP SETELAH LOCK DIPEROLEH
            // -------------------------------------------------

            // Pembacaan ulang mencegah penggunaan status lama
            // akibat request lain yang selesai lebih dahulu.

            $record = otpPemulihanAmbilRecord(
                $pdo,
                $userId
            );

            $sessionOtpId = (string) (
                $_SESSION['pemulihan_id_otp'] ?? ''
            );

            $owned = (
                $record !== null &&
                (string) $record['id_otp'] === $sessionOtpId
            );

            $active = otpPemulihanAktif($record);

            // -------------------------------------------------
            // C. OTP AKTIF, SESSION BELUM MEMILIKI ID OTP
            // -------------------------------------------------

            if ($active && !$owned) {

                // Mempertahankan perilaku pengikatan OTP
                // yang sudah digunakan pada sistem sebelumnya.

                $_SESSION['pemulihan_id_otp'] =
                    (string) $record['id_otp'];

                $issueResponse = [
                    'status' => 200,
                    'success' => true,
                    'message' => 'Kode OTP tersedia. Silakan masukkan kode yang dikirim ke email Anda.',
                    'data' => [
                        'expires_at' => (int) $record['expires_at'],
                        'masked_email' => $maskedEmail,
                        'remaining_attempts' => max(
                            0,
                            3 - (int) $record['jumlah_percobaan']
                        )
                    ]
                ];
            }

            // -------------------------------------------------
            // D. OTP AKTIF DAN SUDAH TERIKAT SESSION
            // -------------------------------------------------

            elseif ($active && $owned) {

                $issueResponse = [
                    'status' => 200,
                    'success' => true,
                    'message' => 'Kode OTP masih berlaku.',
                    'data' => [
                        'expires_at' => (int) $record['expires_at'],
                        'masked_email' => $maskedEmail,
                        'remaining_attempts' => max(
                            0,
                            3 - (int) $record['jumlah_percobaan']
                        )
                    ]
                ];
            }

            // -------------------------------------------------
            // E. MEMERIKSA BATAS PENGIRIMAN OTP
            // -------------------------------------------------

            else {

                // Maksimal 5 pengiriman dalam 15 menit.
                // Pemeriksaan dilakukan saat database lock aktif.

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

                $totalPengiriman = (int) $stmt->fetchColumn();

                if ($totalPengiriman >= 5) {

                    $issueResponse = [
                        'status' => 429,
                        'success' => false,
                        'message' => 'Batas pengiriman OTP tercapai. Silakan coba kembali nanti.',
                        'data' => []
                    ];
                }

                // -------------------------------------------------
                // F. MEMBUAT OTP BARU
                // -------------------------------------------------

                else {

                    $otp = OtpService::create(
                        $pdo,
                        $userId,
                        'Pemulihan'
                    );

                    // -------------------------------------------------
                    // G. MENGAMBIL ID OTP BARU
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
                    // H. MENGIRIM OTP MELALUI EMAIL
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

                        unset(
                            $_SESSION['pemulihan_id_otp']
                        );

                        $issueResponse = [
                            'status' => 500,
                            'success' => false,
                            'message' => 'Gagal mengirim OTP ke email. Silakan coba kembali.',
                            'data' => []
                        ];
                    }

                    // -------------------------------------------------
                    // I. MENGIKAT OTP BARU KE SESSION
                    // -------------------------------------------------

                    else {

                        $_SESSION['pemulihan_id_otp'] =
                            (string) $newOtp['id_otp'];

                        $issueResponse = [
                            'status' => 200,
                            'success' => true,
                            'message' => 'Kode OTP berhasil dikirim ke email Anda.',
                            'data' => [
                                'expires_at' => (int) $newOtp['expires_at'],
                                'masked_email' => $maskedEmail,
                                'remaining_attempts' => 3
                            ]
                        ];
                    }
                }
            }

        } finally {

            // -------------------------------------------------
            // J. MELEPASKAN DATABASE LOCK
            // -------------------------------------------------

            try {

                $releaseStmt = $pdo->prepare("
                    SELECT RELEASE_LOCK(:lock_name)
                ");

                $releaseStmt->execute([
                    ':lock_name' => $lockName
                ]);

            } catch (Throwable $releaseError) {

                error_log(
                    '[SIPFAS OTP PEMULIHAN LOCK] ' .
                    $releaseError->getMessage()
                );
            }
        }

        // Respons diberikan setelah database lock dilepaskan.

        if ($issueResponse !== null) {

            otpPemulihanResponse(
                $issueResponse['status'],
                $issueResponse['success'],
                $issueResponse['message'],
                $issueResponse['data']
            );
        }
    }

    // =====================================================
    // 13. ACTION VERIFY
    // =====================================================

    // -----------------------------------------------------
    // A. MEMASTIKAN OTP MILIK SESSION
    // -----------------------------------------------------

    if (!$record || !$owned) {

        otpPemulihanResponse(
            409,
            false,
            'Kode OTP tidak tersedia untuk sesi ini. Silakan muat ulang halaman.'
        );
    }

    // -----------------------------------------------------
    // B. MEMASTIKAN OTP MASIH AKTIF
    // -----------------------------------------------------

    if (!$active) {

        if ((int) $record['jumlah_percobaan'] >= 3) {

            otpPemulihanResponse(
                429,
                false,
                'Batas percobaan OTP tercapai. Silakan kirim ulang kode.',
                [
                    'remaining_attempts' => 0,
                    'can_resend' => true
                ]
            );
        }

        otpPemulihanResponse(
            410,
            false,
            'Kode OTP sudah kedaluwarsa atau tidak berlaku. Silakan kirim ulang kode.'
        );
    }

    // -----------------------------------------------------
    // C. MEMERIKSA KODE OTP
    // -----------------------------------------------------

    $valid = password_verify(
        $otpInput,
        (string) $record['kode_hash']
    );

    // =====================================================
    // 14. JIKA OTP SALAH
    // =====================================================

    if (!$valid) {

        // -------------------------------------------------
        // PERBAIKAN KEAMANAN UTAMA:
        // PEMBARUAN JUMLAH PERCOBAAN SECARA ATOMIK.
        // -------------------------------------------------

        // Tidak menggunakan nilai lama dari PHP.
        // Database sendiri yang menambah jumlah percobaan.
        //
        // dibatalkan_pada diperbarui terlebih dahulu.
        // Jika jumlah sebelumnya 2, OTP langsung dibatalkan.
        // Kemudian jumlah_percobaan ditambah satu.
        //
        // UPDATE ini dijalankan secara atomik oleh MySQL.

        $stmt = $pdo->prepare("
            UPDATE otp_verifikasi

            SET

                dibatalkan_pada = CASE
                    WHEN jumlah_percobaan >= 2
                    THEN NOW()
                    ELSE dibatalkan_pada
                END,

                jumlah_percobaan = jumlah_percobaan + 1

            WHERE id_otp = :id_otp
            AND id_pengguna = :id_pengguna
            AND tujuan = 'Pemulihan'

            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL

            AND berlaku_sampai > NOW()
            AND jumlah_percobaan < 3
        ");

        $stmt->execute([
            ':id_otp' => $record['id_otp'],
            ':id_pengguna' => $userId
        ]);

        $updated = $stmt->rowCount() === 1;

        // -------------------------------------------------
        // MEMBACA ULANG STATUS TERBARU DARI DATABASE
        // -------------------------------------------------

        $updatedRecord = otpPemulihanAmbilRecord(
            $pdo,
            $userId
        );

        if (!$updatedRecord) {

            otpPemulihanResponse(
                410,
                false,
                'Kode OTP tidak ditemukan.'
            );
        }

        // Memastikan ID OTP tetap sama dengan session.
        if (
            (string) $updatedRecord['id_otp'] !==
            (string) $record['id_otp']
        ) {

            otpPemulihanResponse(
                409,
                false,
                'Status OTP berubah. Silakan muat ulang halaman.'
            );
        }

        $attempts = (int) $updatedRecord['jumlah_percobaan'];

        $expiresAt = (int) $updatedRecord['expires_at'];

        $remaining = max(
            0,
            3 - $attempts
        );

        // -------------------------------------------------
        // JIKA PEMBARUAN DITOLAK DATABASE
        // -------------------------------------------------

        if (!$updated) {

            if ($attempts >= 3) {

                otpPemulihanResponse(
                    429,
                    false,
                    'Batas percobaan OTP tercapai. Silakan kirim ulang kode.',
                    [
                        'remaining_attempts' => 0,
                        'can_resend' => true
                    ]
                );
            }

            if (
                $updatedRecord['digunakan_pada'] !== null ||
                $updatedRecord['dibatalkan_pada'] !== null ||
                $expiresAt <= time()
            ) {

                otpPemulihanResponse(
                    410,
                    false,
                    'Kode OTP sudah tidak berlaku.'
                );
            }

            otpPemulihanResponse(
                409,
                false,
                'Status OTP berubah. Silakan coba kembali.'
            );
        }

        // -------------------------------------------------
        // JIKA SUDAH TIGA KALI SALAH
        // -------------------------------------------------

        if ($attempts >= 3) {

            otpPemulihanResponse(
                429,
                false,
                'Anda telah salah memasukkan OTP sebanyak 3 kali. Silakan kirim ulang kode untuk mendapatkan OTP baru.',
                [
                    'remaining_attempts' => 0,
                    'expires_at' => $expiresAt,
                    'can_resend' => true
                ]
            );
        }

        // -------------------------------------------------
        // JIKA MASIH ADA PERCOBAAN
        // -------------------------------------------------

        otpPemulihanResponse(
            422,
            false,
            'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            [
                'remaining_attempts' => $remaining,
                'expires_at' => $expiresAt
            ]
        );
    }

    // =====================================================
    // 15. JIKA OTP BENAR
    // =====================================================

    // -----------------------------------------------------
    // A. MENANDAI OTP TELAH DIGUNAKAN
    // -----------------------------------------------------

    // Pemeriksaan dilakukan langsung pada database.
    // Dua request benar yang masuk bersamaan tidak dapat
    // menggunakan OTP yang sama dua kali.

    $stmt = $pdo->prepare("
        UPDATE otp_verifikasi

        SET digunakan_pada = NOW()

        WHERE id_otp = :id_otp
        AND id_pengguna = :id_pengguna
        AND tujuan = 'Pemulihan'

        AND digunakan_pada IS NULL
        AND dibatalkan_pada IS NULL

        AND berlaku_sampai > NOW()
        AND jumlah_percobaan < 3
    ");

    $stmt->execute([
        ':id_otp' => $record['id_otp'],
        ':id_pengguna' => $userId
    ]);

    // Hanya satu request yang boleh berhasil.
    if ($stmt->rowCount() !== 1) {

        otpPemulihanResponse(
            410,
            false,
            'Kode OTP sudah digunakan atau tidak berlaku. Silakan kirim ulang kode.'
        );
    }

    // =====================================================
    // 16. MEMPERBARUI SESSION
    // =====================================================

    if (!session_regenerate_id(true)) {

        throw new RuntimeException(
            'Gagal memperbarui session.'
        );
    }

    // Hak untuk membuat password baru.
    $_SESSION['pemulihan_terverifikasi'] = true;

    // Masa berlaku session reset password 10 menit.
    $_SESSION['pemulihan_reset_berlaku_sampai'] =
        time() + 600;

    // Menghapus session OTP sementara.
    unset(
        $_SESSION['pemulihan_id_otp'],
        $_SESSION['pemulihan_pending_expires']
    );

    // =====================================================
    // 17. RESPONS BERHASIL
    // =====================================================

    otpPemulihanResponse(
        200,
        true,
        'Verifikasi OTP berhasil. Silakan buat kata sandi baru.',
        [
            'redirect' => 'password-baru.html'
        ]
    );

} catch (Throwable $e) {

    // =====================================================
    // 18. PENANGANAN ERROR
    // =====================================================

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
