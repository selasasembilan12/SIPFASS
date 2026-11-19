
<?php

/**
 * =========================================================
 * SIPFAS - LOGIN DENGAN VERIFIKASI OTP
 * =========================================================
 *
 * Fungsi:
 * 1. Memeriksa username/email dan password.
 * 2. Memeriksa status akun dan role pengguna.
 * 3. Membuat OTP enam digit.
 * 4. Menyimpan OTP ke database.
 * 5. Mengirim OTP melalui Gmail SMTP.
 * 6. Menyiapkan session sementara untuk verifikasi OTP.
 *
 * =========================================================
 */


// =========================================================
// 1. MEMANGGIL KONFIGURASI DAN SERVICE
// =========================================================

// Memuat bootstrap untuk session dan koneksi PDO.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

// Memuat fungsi respons JSON.
require_once dirname(__DIR__, 2) . '/config/response.php';

// Memuat service pengelolaan OTP.
require_once dirname(__DIR__, 2) . '/services/OtpService.php';

// Memuat service pengiriman email.
require_once dirname(__DIR__, 2) . '/services/MailService.php';


// =========================================================
// 2. KONFIGURASI RESPONS JSON
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');


// =========================================================
// 3. FUNGSI RESPONS API
// =========================================================

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}


// =========================================================
// 4. MEMERIKSA METODE REQUEST
// =========================================================

// Login hanya menerima metode POST.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    header('Allow: POST');

    jsonResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}


// =========================================================
// 5. MEMBACA INPUT PENGGUNA
// =========================================================

// Membaca input JSON dari frontend.
$rawInput = file_get_contents('php://input');

$input = json_decode($rawInput, true);

// Mendukung pengiriman melalui form-data.
if (!is_array($input)) {
    $input = $_POST;
}

// Mengambil identitas pengguna.
$identifier = strtolower(trim(
    (string) (
        $input['identifier']
        ?? $input['email']
        ?? $input['username']
        ?? ''
    )
));

// Mengambil password.
$passwordInput = (string) ($input['password'] ?? '');

// Mengambil jenis pengguna.
$roleInput = strtolower(trim(
    (string) (
        $input['role']
        ?? $input['jenisPengguna']
        ?? ''
    )
));


// =========================================================
// 6. VALIDASI INPUT
// =========================================================

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

// Membatasi panjang identitas pengguna.
if (strlen($identifier) > 150) {

    jsonResponse(
        false,
        'Username atau email terlalu panjang.',
        [],
        422
    );
}

// Membatasi ukuran password.
if (strlen($passwordInput) > 4096) {

    jsonResponse(
        false,
        'Password tidak valid.',
        [],
        422
    );
}


// =========================================================
// 7. MENYESUAIKAN ROLE PENGGUNA
// =========================================================

$roleMap = [

    'admin' => 'Administrator',
    'administrator' => 'Administrator',

    'petugas' => 'Petugas Sarpras',
    'petugas sarpras' => 'Petugas Sarpras',

    'pelapor' => 'Pelapor',
    'user' => 'Pelapor'

];

// Memastikan role termasuk dalam daftar yang diizinkan.
if (!isset($roleMap[$roleInput])) {

    jsonResponse(
        false,
        'Jenis pengguna tidak valid.',
        [],
        422
    );
}

$role = $roleMap[$roleInput];


// =========================================================
// 8. MEMPROSES LOGIN DAN PENGIRIMAN OTP
// =========================================================

try {

    // -----------------------------------------------------
    // A. MENCARI AKUN PENGGUNA
    // -----------------------------------------------------

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

    // Menyiapkan query database.
    $stmt = $pdo->prepare($sql);

    // Menjalankan query.
    $stmt->execute([

        ':identifier_email' => $identifier,
        ':identifier_username' => $identifier,
        ':role' => $role

    ]);

    // Mengambil data pengguna.
    $user = $stmt->fetch(PDO::FETCH_ASSOC);


    // -----------------------------------------------------
    // B. MEMERIKSA PASSWORD
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // C. MEMERIKSA STATUS AKUN
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // D. MEMERIKSA EMAIL PENGGUNA
    // -----------------------------------------------------

    if (
        empty($user['email']) ||
        !filter_var($user['email'], FILTER_VALIDATE_EMAIL)
    ) {

        jsonResponse(
            false,
            'Alamat email akun tidak valid.',
            [],
            422
        );
    }


    // -----------------------------------------------------
    // E. MEMBERSIHKAN SESSION LOGIN SEBELUMNYA
    // -----------------------------------------------------

    unset(
        $_SESSION['user'],
        $_SESSION['id_pengguna'],
        $_SESSION['id_peran'],
        $_SESSION['nama_peran'],
        $_SESSION['nama_lengkap'],
        $_SESSION['sipfas_user'],
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires']
    );

    // Mengganti ID session untuk mencegah session fixation.
    session_regenerate_id(true);


    // -----------------------------------------------------
    // F. MEMBUAT OTP BARU
    // -----------------------------------------------------

    // Membuat OTP enam digit dan menyimpan hash-nya
    // ke tabel otp_verifikasi.
    $otp = OtpService::create(
        $pdo,
        (int) $user['id_pengguna'],
        'Login'
    );


    // -----------------------------------------------------
    // G. MENGIRIM OTP MELALUI EMAIL
    // -----------------------------------------------------

    $emailSent = MailService::sendOtp(
        (string) $user['email'],
        $otp,
        'Login'
    );


    // -----------------------------------------------------
    // H. MEMBATALKAN OTP JIKA EMAIL GAGAL DIKIRIM
    // -----------------------------------------------------

    if (!$emailSent) {

        // Membatalkan OTP yang gagal dikirim.
        OtpService::cancel(
            $pdo,
            (int) $user['id_pengguna'],
            'Login'
        );

        jsonResponse(
            false,
            'Gagal mengirim kode OTP. Silakan coba kembali.',
            [],
            500
        );
    }


// Menyimpan identitas pengguna sementara.
$_SESSION['pending_login'] = [
    'id_pengguna' => (int) $user['id_pengguna'],
    'id_peran' => (int) $user['id_peran'],
    'nama_lengkap' => $user['nama_lengkap'],
    'nama_pengguna' => $user['nama_pengguna'],
    'email' => $user['email'],
    'nama_peran' => $user['nama_peran']
];

// Masa berlaku verifikasi OTP 2 menit.
$_SESSION['pending_login_expires'] = time() + 120;


    // -----------------------------------------------------
    // J. MENYAMARKAN EMAIL PENGGUNA
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // K. MENGIRIM RESPONS KEBERHASILAN
    // -----------------------------------------------------

    jsonResponse(

        true,

        'Kode OTP berhasil dikirim ke email Anda.',

        [

            'requires_otp' => true,

            'email' => $maskedEmail,

            'role' => $user['nama_peran'],

            'redirect' => 'verifikasi-otp.html'

        ],

        200

    );


} catch (Throwable $e) {

    // Mencatat kesalahan ke log server.
    error_log(
        '[SIPFAS LOGIN ERROR] ' . $e->getMessage()
    );

    // Mengirim respons kegagalan.
    jsonResponse(
        false,
        'Terjadi kesalahan saat memproses login.',
        [],
        500
    );
}
