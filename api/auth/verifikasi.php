<?php
declare(strict_types=1);



require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';
require_once __DIR__ . '/riwayat-login-helper.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

// ============================================================
// 01. RESPONS JSON
// ============================================================

function verifikasiResponse(
    int $status,
    bool $success,
    string $message,
    array $data = []
): never {

    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE |
       JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// ============================================================
// 02. MEMERIKSA REQUEST
// ============================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    verifikasiResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType !== 'application/json') {
    verifikasiResponse(
        415,
        false,
        'Gunakan format JSON.'
    );
}

$rawInput = file_get_contents('php://input');

if ($rawInput === false || strlen($rawInput) > 2048) {
    verifikasiResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

$data = json_decode($rawInput, true);

if (!is_array($data)) {
    verifikasiResponse(
        400,
        false,
        'Format data tidak valid.'
    );
}

$action = $data['action'] ?? '';

if (!in_array($action, ['ensure', 'resend', 'verify'], true)) {
    verifikasiResponse(
        422,
        false,
        'Aksi tidak valid.'
    );
}

$otpInput = $data['otp'] ?? '';

if (
    $action === 'verify' &&
    (
        !is_string($otpInput) ||
        !preg_match('/^[0-9]{8}$/D', $otpInput)
    )
) {
    verifikasiResponse(
        422,
        false,
        'Masukkan kode OTP delapan digit.'
    );
}

// ============================================================
// 03. MEMERIKSA SESSION LOGIN SEMENTARA
// ============================================================

$pending = $_SESSION['pending_login'] ?? [];

$idPengguna = (int) ($pending['id_pengguna'] ?? 0);

$pendingExpiry = (int) (
    $_SESSION['pending_login_expires'] ?? 0
);

if (
    $idPengguna <= 0 ||
    empty($_SESSION['login_id_otp'])
) {
    verifikasiResponse(
        401,
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.'
    );
}

if ($pendingExpiry <= time()) {

    unset(
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires'],
        $_SESSION['login_id_otp']
    );

    verifikasiResponse(
        401,
        false,
        'Sesi login kedaluwarsa. Silakan login kembali.'
    );
}

// ============================================================
// 04. PROSES VERIFIKASI
// ============================================================

try {

    // --------------------------------------------------------
    // A. MENGAMBIL DATA PENGGUNA
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nama_pengguna,
            u.email,
            u.nomor_identitas,
            u.unit_kerja,
            u.foto_profil,
            u.status_akun,
            r.nama_peran

        FROM pengguna u

        INNER JOIN peran r
            ON r.id_peran = u.id_peran

        WHERE u.id_pengguna = :id_pengguna

        LIMIT 1
    ");

    $stmt->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        verifikasiResponse(
            404,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    // --------------------------------------------------------
    // B. STATUS AKUN
    // --------------------------------------------------------

    if (
        strcasecmp(
            trim((string) $user['status_akun']),
            'Aktif'
        ) !== 0
    ) {
        verifikasiResponse(
            403,
            false,
            'Akun tidak aktif. Hubungi Administrator.'
        );
    }

    // --------------------------------------------------------
    // C. MENGAMBIL OTP TERBARU
    // --------------------------------------------------------

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

        WHERE id_pengguna = :id_pengguna
        AND tujuan = 'Login'

        ORDER BY id_otp DESC

        LIMIT 1
    ");

    $stmt->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $otpRecord = $stmt->fetch(PDO::FETCH_ASSOC);

    $sessionOtpId = (string) $_SESSION['login_id_otp'];

    $owned = (
        $otpRecord &&
        (string) $otpRecord['id_otp'] === $sessionOtpId
    );

    if ($otpRecord && !$owned) {
        verifikasiResponse(
            409,
            false,
            'Kode OTP tidak sesuai dengan sesi login.'
        );
    }

    $now = time();

    $expiresAt = $otpRecord
        ? (int) $otpRecord['expires_at']
        : 0;

    $attempts = $otpRecord
        ? (int) $otpRecord['jumlah_percobaan']
        : 0;

    $remaining = max(0, 3 - $attempts);

    $isExpired = (
        !$otpRecord ||
        $expiresAt <= $now
    );

    $isExhausted = $attempts >= 3;

    $isUsed = (
        $otpRecord &&
        $otpRecord['digunakan_pada'] !== null
    );

    // --------------------------------------------------------
    // D. MENYAMARKAN EMAIL
    // --------------------------------------------------------

    $emailParts = explode('@', (string) $user['email'], 2);

    $prefix = $emailParts[0] ?? '';
    $domain = $emailParts[1] ?? '';

    $maskedEmail =
        substr($prefix, 0, 2) .
        str_repeat('*', max(1, strlen($prefix) - 2)) .
        '@' . $domain;

    // --------------------------------------------------------
    // E. MEMERIKSA STATUS ENSURE
    // --------------------------------------------------------

    if ($action === 'ensure' && $otpRecord) {

        // PENTING:
        // Jika sudah 3 kali salah, jangan membuat OTP baru
        // ketika halaman di-refresh.

        if ($isExhausted && !$isExpired) {
            verifikasiResponse(
                429,
                false,
                'Batas 3 percobaan OTP telah tercapai. Tunggu hingga masa berlaku OTP berakhir.',
                [
                    'expires_at' => $expiresAt,
                    'remaining_attempts' => 0,
                    'retry_after' => max(0, $expiresAt - $now),
                    'masked_email' => $maskedEmail
                ]
            );
        }

        if ($isExpired || $isUsed ||
            $otpRecord['dibatalkan_pada'] !== null) {

            verifikasiResponse(
                410,
                false,
                'Kode OTP sudah tidak berlaku. Silakan kirim ulang kode.',
                [
                    'expires_at' => $expiresAt,
                    'remaining_attempts' => 0,
                    'masked_email' => $maskedEmail
                ]
            );
        }

        verifikasiResponse(
            200,
            true,
            'Kode OTP masih berlaku.',
            [
                'expires_at' => $expiresAt,
                'masked_email' => $maskedEmail,
                'remaining_attempts' => $remaining
            ]
        );
    }


/* =====================================================
   F. MEMERIKSA OTP PADA SAAT HALAMAN DIBUKA
===================================================== */

if ($action === 'ensure' && $owned && $otpRecord) {

    $remainingAttempts = max(
        0,
        3 - (int) $otpRecord['jumlah_percobaan']
    );

    verifikasiResponse(
        200,
        true,
        $remainingAttempts === 0
            ? 'Batas percobaan OTP telah tercapai.'
            : (
                (int) $otpRecord['expires_at'] <= time()
                    ? 'Kode OTP telah kedaluwarsa.'
                    : 'Kode OTP masih berlaku.'
            ),
        [
            'expires_at' => (int) $otpRecord['expires_at'],
            'masked_email' => $maskedEmail,
            'remaining_attempts' => $remainingAttempts
        ]
    );
}



/* =====================================================
   PEMBATASAN KIRIM ULANG OTP
===================================================== */

if (
    $action === 'resend' &&
    $owned &&
    $otpRecord &&
    $expiresAt > time() &&
    $remaining > 0 &&
    $otpRecord['dibatalkan_pada'] === null
) {
    verifikasiResponse(
        429,
        false,
        'Kode OTP masih berlaku. Silakan gunakan kode yang telah dikirim.',
        [
            'expires_at' => $expiresAt,
            'remaining_attempts' => $remaining
        ]
    );
}


    // --------------------------------------------------------
    // G. MEMBUAT DAN MENGIRIM OTP BARU
    // --------------------------------------------------------

    if ($action === 'ensure' || $action === 'resend') {

        // Batas maksimal 5 pengiriman dalam 15 menit.

        $stmt = $pdo->prepare("
            SELECT COUNT(*)

            FROM otp_verifikasi

            WHERE id_pengguna = :id_pengguna
            AND tujuan = 'Login'
            AND tanggal_dibuat >=
                DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        ");

        $stmt->execute([
            ':id_pengguna' => $idPengguna
        ]);

        if ((int) $stmt->fetchColumn() >= 5) {
            verifikasiResponse(
                429,
                false,
                'Batas pengiriman OTP tercapai. Silakan coba kembali nanti.'
            );
        }

        $otp = OtpService::create(
            $pdo,
            $idPengguna,
            'Login'
        );

        // Mengambil OTP terbaru.

        $stmt = $pdo->prepare("
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

        $stmt->execute([
            ':id_pengguna' => $idPengguna
        ]);

        $newOtp = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$newOtp) {
            throw new RuntimeException(
                'OTP baru tidak ditemukan.'
            );
        }

        // Mengirim email.

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

            verifikasiResponse(
                500,
                false,
                'Gagal mengirim OTP. Silakan coba kembali.'
            );
        }

        // Memperbarui session OTP.

        $_SESSION['login_id_otp'] =
            (string) $newOtp['id_otp'];

        verifikasiResponse(
            200,
            true,
            'Kode OTP berhasil dikirim ke email.',
            [
                'expires_at' => (int) $newOtp['expires_at'],
                'masked_email' => $maskedEmail,
                'remaining_attempts' => 3
            ]
        );
    }

    // --------------------------------------------------------
    // H. MEMERIKSA OTP UNTUK VERIFIKASI
    // --------------------------------------------------------

    if (!$otpRecord || !$owned) {
        verifikasiResponse(
            409,
            false,
            'Kode OTP tidak tersedia untuk sesi ini.'
        );
    }

    // Tiga kali salah tetap terkunci hingga expiry.
    // Status ini dikembalikan sebelum pemeriksaan OTP aktif.

    if ($isExhausted && !$isExpired) {
        verifikasiResponse(
            429,
            false,
            'Batas 3 percobaan OTP telah tercapai. Tunggu hingga masa berlaku OTP berakhir.',
            [
                'expires_at' => $expiresAt,
                'remaining_attempts' => 0,
                'retry_after' => max(0, $expiresAt - $now)
            ]
        );
    }

    if ($isExpired || $isUsed ||
        $otpRecord['dibatalkan_pada'] !== null) {

        verifikasiResponse(
            410,
            false,
            'Kode OTP telah kedaluwarsa atau tidak berlaku.',
            [
                'expires_at' => $expiresAt,
                'remaining_attempts' => $remaining
            ]
        );
    }

    // --------------------------------------------------------
    // I. MEMERIKSA KODE OTP
    // --------------------------------------------------------

    $isValid = password_verify(
        $otpInput,
        (string) $otpRecord['kode_hash']
    );

    if (!$isValid) {

        // Menambah percobaan secara langsung di database.
        // Nilai dibatasi agar tidak melebihi 3.

        $stmt = $pdo->prepare("
            UPDATE otp_verifikasi

            SET
                jumlah_percobaan = jumlah_percobaan + 1,

                dibatalkan_pada = CASE
                    WHEN jumlah_percobaan + 1 >= 3
                    THEN NOW()
                    ELSE dibatalkan_pada
                END

            WHERE id_otp = :id_otp
            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL
            AND berlaku_sampai > NOW()
            AND jumlah_percobaan < 3
        ");

        $stmt->execute([
            ':id_otp' => $otpRecord['id_otp']
        ]);

        // Membaca ulang jumlah percobaan dari DB.

        $stmt = $pdo->prepare("
            SELECT
                jumlah_percobaan,
                UNIX_TIMESTAMP(berlaku_sampai) AS expires_at

            FROM otp_verifikasi

            WHERE id_otp = :id_otp

            LIMIT 1
        ");

        $stmt->execute([
            ':id_otp' => $otpRecord['id_otp']
        ]);

        $updated = $stmt->fetch(PDO::FETCH_ASSOC);

        $attempts = (int) $updated['jumlah_percobaan'];

        $expiresAt = (int) $updated['expires_at'];

        $remaining = max(0, 3 - $attempts);

        if ($remaining === 0) {
            verifikasiResponse(
                429,
                false,
                'Anda telah salah memasukkan OTP sebanyak 3 kali. Tunggu hingga masa berlaku OTP berakhir sebelum mengirim ulang kode.',
                [
                    'remaining_attempts' => 0,
                    'expires_at' => $expiresAt,
                    'retry_after' => max(0, $expiresAt - time())
                ]
            );
        }

        verifikasiResponse(
            422,
            false,
            'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            [
                'remaining_attempts' => $remaining,
                'expires_at' => $expiresAt
            ]
        );
    }

    // --------------------------------------------------------
    // J. MENANDAI OTP TELAH DIGUNAKAN
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        UPDATE otp_verifikasi

        SET digunakan_pada = NOW()

        WHERE id_otp = :id_otp
        AND digunakan_pada IS NULL
        AND dibatalkan_pada IS NULL
        AND berlaku_sampai > NOW()
        AND jumlah_percobaan < 3
    ");

    $stmt->execute([
        ':id_otp' => $otpRecord['id_otp']
    ]);

    if ($stmt->rowCount() !== 1) {
        verifikasiResponse(
            410,
            false,
            'Kode OTP sudah tidak berlaku.'
        );
    }

    // --------------------------------------------------------
    // K. RESET LOGIN GAGAL
    // --------------------------------------------------------

    $stmt = $pdo->prepare("
        UPDATE pengguna

        SET
            jumlah_login_gagal = 0,
            login_diblokir_sampai = NULL

        WHERE id_pengguna = :id_pengguna
    ");

    $stmt->execute([
        ':id_pengguna' => $idPengguna
    ]);

    // --------------------------------------------------------
    // L. MENENTUKAN DASHBOARD BERDASARKAN ROLE
    // --------------------------------------------------------

    $routes = [
        'Administrator' =>
            '../Admin/Dashboard/Dashboard.html',

        'Petugas Sarpras' =>
            '../Petugas/Dashboard/Dashboard.html',

        'Pelapor' =>
            '../User/Dashboard/Dashboard/dashboard.html'
    ];

    $role = (string) $user['nama_peran'];

    if (!isset($routes[$role])) {
        verifikasiResponse(
            403,
            false,
            'Role pengguna tidak dikenali.'
        );
    }

    // --------------------------------------------------------
    // M. MEMBUAT SESSION RESMI
    // --------------------------------------------------------

    if (!session_regenerate_id(true)) {
        throw new RuntimeException(
            'Gagal memperbarui session ID.'
        );
    }

    $authenticatedUser = [
        'id_pengguna' => (int) $user['id_pengguna'],
        'id_peran' => (int) $user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nomor_identitas' => $user['nomor_identitas'],
        'unit_kerja' => $user['unit_kerja'],
        'foto_profil' => $user['foto_profil'],
        'nama_peran' => $role
    ];

    $_SESSION['user'] = $authenticatedUser;
    $_SESSION['id_pengguna'] = (int) $user['id_pengguna'];
    $_SESSION['id_peran'] = (int) $user['id_peran'];
    $_SESSION['nama_peran'] = $role;
    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
    $_SESSION['sipfas_user'] = $authenticatedUser;
    $_SESSION['login_terverifikasi'] = true;


// --------------------------------------------------------
// MENCATAT RIWAYAT LOGIN KE DATABASE.
// Berlaku untuk Administrator, Petugas, dan Pelapor.
// --------------------------------------------------------

$riwayatLoginTersimpan = catatRiwayatLogin(
    $pdo,
    $user
);

if (!$riwayatLoginTersimpan) {
    error_log(
        '[SIPFAS] Login berhasil, tetapi riwayat login gagal disimpan. ' .
        'ID Pengguna: ' . (int) $user['id_pengguna']
    );
}

    // --------------------------------------------------------
    // N. MENGHAPUS SESSION LOGIN SEMENTARA
    // --------------------------------------------------------

    unset(
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires'],
        $_SESSION['login_id_otp']
    );

    session_write_close();

    // --------------------------------------------------------
    // O. RESPONS BERHASIL
    // --------------------------------------------------------

    verifikasiResponse(
        200,
        true,
        'Verifikasi berhasil! Selamat datang di SIPFAS.',
        [
            'redirect' => $routes[$role],
            'user' => [
                'id_pengguna' => (int) $user['id_pengguna'],
                'nama_lengkap' => $user['nama_lengkap'],
                'nama_pengguna' => $user['nama_pengguna'],
                'nama_peran' => $role
            ]
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS VERIFIKASI ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    verifikasiResponse(
        500,
        false,
        'Terjadi kesalahan saat memverifikasi OTP.'
    );
}
