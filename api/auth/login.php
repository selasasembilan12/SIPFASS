<?php
declare(strict_types=1);

ob_start();

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$responseSent = false;

/* =========================================================
   01. KONSTANTA KEAMANAN
========================================================= */

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MINUTES = 15;

/* =========================================================
   02. RESPONS JSON
========================================================= */

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {

    global $responseSent;

    $responseSent = true;

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE |
       JSON_UNESCAPED_SLASHES |
       JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

/* =========================================================
   03. PENANGANAN FATAL ERROR
========================================================= */

register_shutdown_function(function () use (&$responseSent) {

    $error = error_get_last();

    $fatalTypes = [
        E_ERROR,
        E_PARSE,
        E_CORE_ERROR,
        E_COMPILE_ERROR,
        E_USER_ERROR
    ];

    if (
        !$responseSent &&
        $error &&
        in_array($error['type'], $fatalTypes, true)
    ) {

        error_log(
            '[SIPFAS LOGIN FATAL] ' .
            $error['message'] . ' | ' .
            $error['file'] . ':' .
            $error['line']
        );

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }

        echo json_encode([
            'success' => false,
            'message' => 'Terjadi kesalahan internal server SIPFAS.',
            'data' => []
        ], JSON_UNESCAPED_UNICODE);
    }
});

/* =========================================================
   04. MEMERIKSA METODE REQUEST
========================================================= */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    jsonResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}

/* =========================================================
   05. MEMUAT KONFIGURASI DAN SERVICE
========================================================= */

try {

    require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
    // Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

    require_once dirname(__DIR__, 2) . '/services/OtpService.php';

    require_once dirname(__DIR__, 2) . '/services/MailService.php';

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Koneksi PDO tidak tersedia.');
    }

    /* =====================================================
       06. MEMBACA INPUT LOGIN
    ===================================================== */

    $rawInput = file_get_contents('php://input');

    $input = json_decode($rawInput, true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    $identifier = strtolower(trim(
        (string) (
            $input['identifier'] ??
            $input['email'] ??
            $input['username'] ??
            ''
        )
    ));

    $passwordInput = (string) (
        $input['password'] ?? ''
    );

    $roleInput = strtolower(trim(
        (string) (
            $input['role'] ??
            $input['jenisPengguna'] ??
            ''
        )
    ));

    /* =====================================================
       07. VALIDASI INPUT
    ===================================================== */

    if (
        $identifier === '' ||
        $passwordInput === '' ||
        $roleInput === ''
    ) {

        jsonResponse(
            false,
            'Username/email, password, dan jenis pengguna wajib diisi.',
            [],
            422
        );
    }

    if (
        strlen($identifier) > 150 ||
        strlen($passwordInput) > 4096
    ) {

        jsonResponse(
            false,
            'Data login tidak valid.',
            [],
            422
        );
    }

    /* =====================================================
       08. NORMALISASI ROLE
    ===================================================== */

    $roleMap = [
        'admin' => 'Administrator',
        'administrator' => 'Administrator',

        'petugas' => 'Petugas Sarpras',
        'petugas sarpras' => 'Petugas Sarpras',

        'pelapor' => 'Pelapor',
        'user' => 'Pelapor'
    ];

    if (!isset($roleMap[$roleInput])) {

        jsonResponse(
            false,
            'Jenis pengguna tidak valid.',
            [],
            422
        );
    }

    $role = $roleMap[$roleInput];

    /* =====================================================
       09. MENCARI DAN MENGUNCI DATA PENGGUNA
    ===================================================== */

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nama_pengguna,
            u.email,
            u.kata_sandi,
            u.status_akun,
            u.email_terverifikasi_pada,
            COALESCE(u.jumlah_login_gagal, 0)
                AS jumlah_login_gagal,
            u.login_diblokir_sampai,
            UNIX_TIMESTAMP(u.login_diblokir_sampai)
                AS blocked_until,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE
            u.email = :identifier_email
            OR u.nama_pengguna = :identifier_username

        LIMIT 1

        FOR UPDATE
    ");

    $stmt->execute([
        ':identifier_email' => $identifier,
        ':identifier_username' => $identifier
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    /* =====================================================
       10. MEMERIKSA KEBERADAAN AKUN
    ===================================================== */

    if (!$user) {

        $pdo->commit();

        jsonResponse(
            false,
            'Username/email, password, atau jenis pengguna salah.',
            [],
            401
        );
    }

    $idPengguna = (int) $user['id_pengguna'];

    $failedAttempts = (int) $user['jumlah_login_gagal'];

    $blockedUntil = (int) ($user['blocked_until'] ?? 0);

    /* =====================================================
       11. MEMERIKSA MASA PEMBLOKIRAN
    ===================================================== */

    if (
        $blockedUntil > 0 &&
        $blockedUntil <= time()
    ) {

        // Masa pemblokiran telah selesai.
        // Mengembalikan penghitung ke nol.

        $reset = $pdo->prepare("
            UPDATE pengguna
            SET
                jumlah_login_gagal = 0,
                login_diblokir_sampai = NULL
            WHERE id_pengguna = :id_pengguna
        ");

        $reset->execute([
            ':id_pengguna' => $idPengguna
        ]);

        $failedAttempts = 0;
        $blockedUntil = 0;
    }

    /* =====================================================
       12. MENOLAK AKUN YANG MASIH DIBLOKIR
    ===================================================== */

    if (
        $blockedUntil > time() &&
        $user['login_diblokir_sampai'] !== null
    ) {

        $pdo->commit();

        jsonResponse(
            false,
            'Akun Anda sementara diblokir karena terlalu banyak percobaan login gagal.',
            [
                'blocked' => true,
                'blocked_until' => $blockedUntil,
                'remaining_seconds' => max(
                    0,
                    $blockedUntil - time()
                )
            ],
            429
        );
    }

    /* =====================================================
       13. MEMERIKSA PASSWORD DAN ROLE
    ===================================================== */

    $passwordValid = password_verify(
        $passwordInput,
        (string) $user['kata_sandi']
    );

    $roleValid = (
        strcasecmp(
            trim((string) $user['nama_peran']),
            $role
        ) === 0
    );

    if (!$passwordValid || !$roleValid) {

        $failedAttempts++;

        $isBlocked = (
            $failedAttempts >= MAX_LOGIN_ATTEMPTS
        );

        // Memperbarui jumlah login gagal.
        // Percobaan kelima akan memblokir akun 15 menit.

        $update = $pdo->prepare("
            UPDATE pengguna
            SET
                jumlah_login_gagal = :jumlah,
                login_diblokir_sampai =
                    CASE
                        WHEN :jumlah_blokir >= :maksimal
                        THEN DATE_ADD(
                            NOW(),
                            INTERVAL 15 MINUTE
                        )
                        ELSE NULL
                    END
            WHERE id_pengguna = :id_pengguna
        ");

        $update->execute([
            ':jumlah' => $failedAttempts,
            ':jumlah_blokir' => $failedAttempts,
            ':maksimal' => MAX_LOGIN_ATTEMPTS,
            ':id_pengguna' => $idPengguna
        ]);

        $blockedUntil = 0;

        if ($isBlocked) {

            $timeQuery = $pdo->prepare("
                SELECT UNIX_TIMESTAMP(login_diblokir_sampai)
                FROM pengguna
                WHERE id_pengguna = :id_pengguna
            ");

            $timeQuery->execute([
                ':id_pengguna' => $idPengguna
            ]);

            $blockedUntil = (int) $timeQuery->fetchColumn();
        }

        $pdo->commit();

        if ($isBlocked) {

            jsonResponse(
                false,
                'Login gagal 5 kali. Akun Anda diblokir selama 15 menit.',
                [
                    'blocked' => true,
                    'blocked_until' => $blockedUntil,
                    'remaining_attempts' => 0,
                    'remaining_seconds' => max(
                        0,
                        $blockedUntil - time()
                    )
                ],
                429
            );
        }

        jsonResponse(
            false,
            'Username/email, password, atau jenis pengguna salah.',
            [
                'blocked' => false,
                'remaining_attempts' => (
                    MAX_LOGIN_ATTEMPTS - $failedAttempts
                ),
                'failed_attempts' => $failedAttempts
            ],
            401
        );
    }

    /* =====================================================
       14. MEMERIKSA STATUS AKUN
    ===================================================== */

    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        $pdo->commit();

        jsonResponse(
            false,
            'Akun Anda tidak aktif. Hubungi Administrator.',
            [],
            403
        );
    }

    /* =====================================================
       15. MEMERIKSA EMAIL
    ===================================================== */

    if (
        empty($user['email']) ||
        !filter_var(
            $user['email'],
            FILTER_VALIDATE_EMAIL
        )
    ) {

        $pdo->commit();

        jsonResponse(
            false,
            'Alamat email akun tidak valid.',
            [],
            422
        );
    }

    $pdo->commit();

    /* =====================================================
       16. MEMBERSIHKAN SESSION LOGIN SEBELUMNYA
    ===================================================== */

    unset(
        $_SESSION['user'],
        $_SESSION['id_pengguna'],
        $_SESSION['id_peran'],
        $_SESSION['nama_peran'],
        $_SESSION['nama_lengkap'],
        $_SESSION['sipfas_user'],
        $_SESSION['login_terverifikasi'],
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires'],
        $_SESSION['login_id_otp']
    );

    if (!session_regenerate_id(true)) {

        jsonResponse(
            false,
            'Gagal membuat sesi login.',
            [],
            500
        );
    }

    /* =====================================================
       17. MEMBUAT OTP
    ===================================================== */

    $otp = OtpService::create(
        $pdo,
        $idPengguna,
        'Login'
    );

    /* =====================================================
       18. MENGAMBIL ID OTP
    ===================================================== */

    $otpQuery = $pdo->prepare("
        SELECT
            id_otp,
            UNIX_TIMESTAMP(berlaku_sampai) AS expires_at

        FROM otp_verifikasi

        WHERE id_pengguna = :id_pengguna
        AND tujuan = 'Login'
        AND digunakan_pada IS NULL
        AND dibatalkan_pada IS NULL

        ORDER BY id_otp DESC
        LIMIT 1
    ");

    $otpQuery->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $otpRecord = $otpQuery->fetch(PDO::FETCH_ASSOC);

    if (!$otpRecord) {

        OtpService::cancel(
            $pdo,
            $idPengguna,
            'Login'
        );

        jsonResponse(
            false,
            'Gagal menyiapkan kode verifikasi.',
            [],
            500
        );
    }

    /* =====================================================
       19. MENGIRIM OTP MELALUI EMAIL
    ===================================================== */

    $emailSent = MailService::sendOtp(
        (string) $user['email'],
        $otp,
        'Login'
    );

    if (!$emailSent) {

        OtpService::cancel(
            $pdo,
            $idPengguna,
            'Login'
        );

        jsonResponse(
            false,
            'Gagal mengirim OTP. Periksa konfigurasi SMTP.',
            [],
            500
        );
    }

    /* =====================================================
       20. MENYIMPAN SESSION LOGIN SEMENTARA
    ===================================================== */

    $_SESSION['pending_login'] = [
        'id_pengguna' => $idPengguna,
        'id_peran' => (int) $user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nama_peran' => $user['nama_peran']
    ];

    $_SESSION['login_id_otp'] = (string) $otpRecord['id_otp'];

    $_SESSION['pending_login_expires'] = time() + 900;

    /* =====================================================
       21. MENYAMARKAN EMAIL
    ===================================================== */

    $emailParts = explode(
        '@',
        (string) $user['email'],
        2
    );

    $emailPrefix = $emailParts[0] ?? '';
    $emailDomain = $emailParts[1] ?? '';

    $maskedEmail =
        substr($emailPrefix, 0, 2) .
        str_repeat(
            '*',
            max(1, strlen($emailPrefix) - 2)
        ) .
        '@' .
        $emailDomain;

    /* =====================================================
       22. MENYIMPAN SESSION
    ===================================================== */

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    /* =====================================================
       23. RESPONS LOGIN BERHASIL
    ===================================================== */

    jsonResponse(
        true,
        'Kode OTP berhasil dikirim ke email Anda.',
        [
            'requires_otp' => true,
            'email' => $maskedEmail,
            'role' => $user['nama_peran'],
            'redirect' => 'verifikasi.html',
            'expires_at' => (int) $otpRecord['expires_at']
        ],
        200
    );

} catch (Throwable $e) {

    if (
        isset($pdo) &&
        $pdo instanceof PDO &&
        $pdo->inTransaction()
    ) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS LOGIN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage() . ' | ' .
        $e->getFile() . ':' .
        $e->getLine()
    );

    jsonResponse(
        false,
        'Terjadi kesalahan server saat memproses login.',
        [],
        500
    );
}