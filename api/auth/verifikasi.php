<?php
declare(strict_types=1);

/**
 * SIPFAS - VERIFIKASI OTP
 *
 * Fitur:
 * 1. Verifikasi OTP 8 digit.
 * 2. OTP berlaku 2 menit.
 * 3. Maksimal 3 percobaan OTP.
 * 4. Pengiriman ulang OTP.
 * 5. Pembatasan pengiriman OTP.
 * 6. Reset penghitung login setelah OTP berhasil.
 * 7. Session resmi berdasarkan role.
 */

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

/* =========================================================
   01. RESPONS JSON
========================================================= */

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

/* =========================================================
   02. MEMERIKSA METODE REQUEST
========================================================= */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    verifikasiResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

/* =========================================================
   03. MEMERIKSA FORMAT INPUT
========================================================= */

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

$rawInput = file_get_contents(
    'php://input',
    false,
    null,
    0,
    2049
);

$data = json_decode($rawInput, true);

if (!is_array($data)) {

    verifikasiResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

/* =========================================================
   04. MEMERIKSA ACTION
========================================================= */

$action = $data['action'] ?? 'verify';

if (
    !in_array(
        $action,
        ['ensure', 'resend', 'verify'],
        true
    )
) {

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

/* =========================================================
   05. MEMERIKSA SESSION LOGIN SEMENTARA
========================================================= */

$pending = $_SESSION['pending_login'] ?? [];

$idPengguna = (int) (
    $pending['id_pengguna'] ?? 0
);

$pendingExpiry = (int) (
    $_SESSION['pending_login_expires'] ?? 0
);

if (
    $idPengguna <= 0 ||
    !isset($_SESSION['login_id_otp'])
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

/* =========================================================
   06. MEMPROSES VERIFIKASI
========================================================= */

try {

    /* =====================================================
       A. MENGAMBIL DATA PENGGUNA
    ===================================================== */

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

    /* =====================================================
       B. MEMERIKSA STATUS AKUN
    ===================================================== */

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

    /* =====================================================
       C. MENGAMBIL DATA OTP
    ===================================================== */

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

    /* =====================================================
       D. MEMERIKSA AKTIVITAS OTP
    ===================================================== */

    $active = (
        $otpRecord &&
        $otpRecord['digunakan_pada'] === null &&
        $otpRecord['dibatalkan_pada'] === null &&
        (int) $otpRecord['expires_at'] > time() &&
        (int) $otpRecord['jumlah_percobaan'] < 3
    );

    /* =====================================================
       E. MENYAMARKAN EMAIL
    ===================================================== */

    $emailParts = explode(
        '@',
        (string) $user['email'],
        2
    );

    $prefix = $emailParts[0] ?? '';
    $domain = $emailParts[1] ?? '';

    $maskedEmail =
        substr($prefix, 0, 2) .
        str_repeat(
            '*',
            max(1, strlen($prefix) - 2)
        ) .
        '@' .
        $domain;

    /* =====================================================
       F. MEMERIKSA OTP YANG MASIH AKTIF
    ===================================================== */

    if ($action === 'ensure' && $active) {

        if (!$owned) {

            verifikasiResponse(
                409,
                false,
                'OTP tidak sesuai dengan sesi login.'
            );
        }

        verifikasiResponse(
            200,
            true,
            'Kode OTP masih berlaku.',
            [
                'expires_at' => (int) $otpRecord['expires_at'],
                'masked_email' => $maskedEmail,
                'remaining_attempts' => max(
                    0,
                    3 - (int) $otpRecord['jumlah_percobaan']
                )
            ]
        );
    }

    /* =====================================================
       G. MENGIRIM OTP BARU
    ===================================================== */

    if (
        $action === 'ensure' ||
        $action === 'resend'
    ) {

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
                'Batas pengiriman OTP tercapai. Coba lagi nanti.'
            );
        }

        $otp = OtpService::create(
            $pdo,
            $idPengguna,
            'Login'
        );

        /* Mengambil OTP terbaru. */

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

        /* Mengirim OTP melalui email. */

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

        /* Memperbarui session OTP. */

$_SESSION['login_id_otp'] = (string) $newOtp['id_otp'];
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

    /* =====================================================
       H. MEMERIKSA KEPEMILIKAN OTP
    ===================================================== */

    if (!$owned || !$otpRecord) {

        verifikasiResponse(
            409,
            false,
            'Kode OTP tidak tersedia untuk sesi ini.'
        );
    }

    if (!$active) {

        verifikasiResponse(
            410,
            false,
            'Kode OTP kedaluwarsa atau tidak berlaku.'
        );
    }

    /* =====================================================
       I. MEMERIKSA KODE OTP
    ===================================================== */

    $isValid = password_verify(
        $otpInput,
        (string) $otpRecord['kode_hash']
    );

    if (!$isValid) {

        $attempts = (
            (int) $otpRecord['jumlah_percobaan'] + 1
        );

        $stmt = $pdo->prepare("
            UPDATE otp_verifikasi

            SET
                jumlah_percobaan = :jumlah,

                dibatalkan_pada = CASE
                    WHEN :jumlah2 >= 3
                    THEN NOW()
                    ELSE dibatalkan_pada
                END

            WHERE id_otp = :id_otp
            AND digunakan_pada IS NULL
            AND dibatalkan_pada IS NULL
        ");

        $stmt->execute([
            ':jumlah' => $attempts,
            ':jumlah2' => $attempts,
            ':id_otp' => $otpRecord['id_otp']
        ]);

        verifikasiResponse(
            $attempts >= 3 ? 429 : 422,
            false,
            $attempts >= 3
                ? 'Batas percobaan OTP tercapai. Silakan kirim OTP baru.'
                : 'Kode OTP salah. Percobaan ' . $attempts . '/3.',
            [
                'remaining_attempts' => max(
                    0,
                    3 - $attempts
                )
            ]
        );
    }

    /* =====================================================
       J. MENANDAI OTP TELAH DIGUNAKAN
    ===================================================== */

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

    /* =====================================================
       K. RESET PENGHITUNG LOGIN GAGAL
    ===================================================== */

    // Reset dilakukan setelah OTP benar.
    // Dengan demikian, login dianggap berhasil
    // setelah kedua tahap autentikasi selesai.

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

    /* =====================================================
       L. MENENTUKAN HALAMAN BERDASARKAN ROLE
    ===================================================== */

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

/* =====================================================
   M. MEMBUAT SESSION RESMI
===================================================== */

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
    /* =====================================================
       N. MENGHAPUS SESSION LOGIN SEMENTARA
    ===================================================== */

    unset(
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires'],
        $_SESSION['login_id_otp']
    );

    /* =====================================================
       O. MENYIMPAN SESSION
    ===================================================== */

    session_write_close();

    /* =====================================================
       P. RESPONS BERHASIL
    ===================================================== */

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
