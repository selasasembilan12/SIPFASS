
<?php

/**
 * SIPFAS - LOGIN API
 * Backend: PHP PDO + MariaDB
 * Autentikasi: Password + OTP
 */

// =========================================================
// 1. PENGATURAN RESPONS DAN ERROR
// =========================================================

// Menampung output agar tidak tercampur dengan JSON.
ob_start();

// Menyembunyikan error dari browser.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Header respons API.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// Penanda agar respons tidak dikirim dua kali.
$responseSent = false;


// =========================================================
// 2. FUNGSI RESPONS JSON
// =========================================================

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {

    global $responseSent;

    $responseSent = true;

    // Membersihkan output dari file yang dipanggil.
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($status);

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE |
       JSON_UNESCAPED_SLASHES |
       JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}


// =========================================================
// 3. PENANGANAN FATAL ERROR
// =========================================================

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

        // Mencatat lokasi dan penyebab fatal error.
        error_log(
            '[SIPFAS LOGIN FATAL] ' .
            $error['message'] . ' | ' .
            $error['file'] . ':' .
            $error['line']
        );

        // Membersihkan output sebelumnya.
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }

        echo json_encode([
            'success' => false,
            'message' => 'Terjadi kesalahan internal server SIPFAS.',
            'data' => []
        ], JSON_UNESCAPED_UNICODE);
    }
});


// =========================================================
// 4. MEMERIKSA METODE REQUEST
// =========================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    jsonResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}


// =========================================================
// 5. MEMUAT KONFIGURASI DAN SERVICE
// =========================================================

try {

    // Bootstrap mengatur session dan koneksi PDO.
    require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

    // Memastikan koneksi database tersedia.
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException(
            'Koneksi PDO tidak tersedia.'
        );
    }

    // Memuat service OTP.
    require_once dirname(__DIR__, 2) . '/services/OtpService.php';

    // Memuat service email.
    require_once dirname(__DIR__, 2) . '/services/MailService.php';


    // =====================================================
    // 6. MEMBACA INPUT LOGIN
    // =====================================================

    $rawInput = file_get_contents('php://input');

    $input = json_decode($rawInput, true);

    // Mendukung JSON dan form POST.
    if (!is_array($input)) {
        $input = $_POST;
    }

    // Mengambil username atau email.
    $identifier = strtolower(trim(
        (string) (
            $input['identifier'] ??
            $input['email'] ??
            $input['username'] ??
            ''
        )
    ));

    // Mengambil password.
    $passwordInput = (string) (
        $input['password'] ?? ''
    );

    // Mengambil jenis pengguna.
    $roleInput = strtolower(trim(
        (string) (
            $input['role'] ??
            $input['jenisPengguna'] ??
            ''
        )
    ));


    // =====================================================
    // 7. VALIDASI INPUT
    // =====================================================

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

    if (strlen($identifier) > 150) {

        jsonResponse(
            false,
            'Username atau email terlalu panjang.',
            [],
            422
        );
    }

    if (strlen($passwordInput) > 4096) {

        jsonResponse(
            false,
            'Password melebihi batas yang diperbolehkan.',
            [],
            422
        );
    }


    // =====================================================
    // 8. NORMALISASI ROLE
    // =====================================================

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


    // =====================================================
    // 9. MENCARI AKUN DALAM DATABASE
    // =====================================================

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
        INNER JOIN peran p
            ON p.id_peran = u.id_peran
        WHERE (
            u.email = :identifier_email
            OR u.nama_pengguna = :identifier_username
        )
        AND p.nama_peran = :role
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ':identifier_email' => $identifier,
        ':identifier_username' => $identifier,
        ':role' => $role
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);


    // =====================================================
    // 10. MEMERIKSA PASSWORD
    // =====================================================

    if (
        !$user ||
        !password_verify(
            $passwordInput,
            (string) $user['kata_sandi']
        )
    ) {

        jsonResponse(
            false,
            'Username/email, password, atau jenis pengguna salah.',
            [],
            401
        );
    }


    // =====================================================
    // 11. MEMERIKSA STATUS AKUN
    // =====================================================

    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {

        jsonResponse(
            false,
            'Akun Anda tidak aktif. Hubungi Administrator.',
            [],
            403
        );
    }


    // =====================================================
    // 12. MEMERIKSA EMAIL
    // =====================================================

    if (
        empty($user['email']) ||
        !filter_var(
            $user['email'],
            FILTER_VALIDATE_EMAIL
        )
    ) {

        jsonResponse(
            false,
            'Alamat email akun tidak valid.',
            [],
            422
        );
    }


    // =====================================================
    // 13. MEMBERSIHKAN SESSION LOGIN SEBELUMNYA
    // =====================================================

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

    // Mencegah session fixation.
    if (!session_regenerate_id(true)) {

        jsonResponse(
            false,
            'Gagal membuat sesi login.',
            [],
            500
        );
    }


    // =====================================================
    // 14. MEMBUAT OTP BARU
    // =====================================================

    $idPengguna = (int) $user['id_pengguna'];

    $otp = OtpService::create(
        $pdo,
        $idPengguna,
        'Login'
    );


    // =====================================================
    // 15. MENGAMBIL ID OTP DARI DATABASE
    // =====================================================

    $otpQuery = $pdo->prepare("
        SELECT
            id_otp,
            UNIX_TIMESTAMP(berlaku_sampai) AS expires_at
        FROM otp_verifikasi
        WHERE id_pengguna = :id_pengguna
        AND tujuan = :tujuan
        AND digunakan_pada IS NULL
        AND dibatalkan_pada IS NULL
        ORDER BY id_otp DESC
        LIMIT 1
    ");

    $otpQuery->execute([
        ':id_pengguna' => $idPengguna,
        ':tujuan' => 'Login'
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


    // =====================================================
    // 16. MENGIRIM OTP KE EMAIL
    // =====================================================

    $emailSent = MailService::sendOtp(
        (string) $user['email'],
        $otp,
        'Login'
    );

    // Membatalkan OTP jika email gagal dikirim.
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


    // =====================================================
    // 17. MEMBUAT SESSION SEMENTARA
    // =====================================================

    $_SESSION['pending_login'] = [
        'id_pengguna' => $idPengguna,
        'id_peran' => (int) $user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nama_peran' => $user['nama_peran']
    ];

    // Mengikat OTP dengan session pengguna.
    $_SESSION['login_id_otp'] = (string) $otpRecord['id_otp'];

    // Session sementara berlaku 15 menit.
    // OTP sendiri tetap berlaku 2 menit.
    $_SESSION['pending_login_expires'] = time() + 900;


    // =====================================================
    // 18. MENYAMARKAN EMAIL
    // =====================================================

    $emailParts = explode(
        '@',
        (string) $user['email'],
        2
    );

    $emailPrefix = $emailParts[0];
    $emailDomain = $emailParts[1] ?? '';

    $maskedEmail =
        substr($emailPrefix, 0, 2) .
        str_repeat(
            '*',
            max(1, strlen($emailPrefix) - 2)
        ) .
        '@' .
        $emailDomain;


    // =====================================================
    // 19. MENYIMPAN SESSION
    // =====================================================

    // Memastikan data session tersimpan sebelum respons.
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }


    // =====================================================
    // 20. RESPONS LOGIN BERHASIL
    // =====================================================

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

    // Mencatat penyebab error untuk pemeriksaan administrator.
    error_log(
        '[SIPFAS LOGIN ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage() . ' | ' .
        $e->getFile() . ':' .
        $e->getLine()
    );

    // Mengembalikan JSON tanpa membocorkan detail internal.
    jsonResponse(
        false,
        'Terjadi kesalahan server saat memproses login. Periksa error log PHP.',
        [],
        500
    );
}
