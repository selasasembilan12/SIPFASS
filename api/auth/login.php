//fiks
<?php

// Memuat konfigurasi sistem, koneksi database, dan service
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';
require_once dirname(__DIR__, 2) . '/config/response.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';

// Mengatur header respons JSON dan zona waktu WIT
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
date_default_timezone_set('Asia/Jayapura');

// Helper respons JSON standar
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
        'data'    => $data
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// Memastikan metode request adalah POST
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    jsonResponse(false, 'Metode permintaan tidak diizinkan.', [], 405);
}

// Memastikan koneksi PDO tersedia
if (!isset($pdo) || !($pdo instanceof PDO)) {
    error_log('[SIPFAS LOGIN] Koneksi PDO tidak tersedia.');
    jsonResponse(false, 'Koneksi database tidak tersedia.', [], 500);
}

// Membaca input JSON atau form POST
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$identifier = strtolower(trim(
    (string) ($input['identifier'] ?? $input['email'] ?? $input['username'] ?? '')
));
$passwordInput = (string) ($input['password'] ?? '');
$roleInput = strtolower(trim(
    (string) ($input['role'] ?? $input['jenisPengguna'] ?? '')
));

// Validasi kelengkapan dan panjang input
if ($identifier === '' || $passwordInput === '' || $roleInput === '') {
    jsonResponse(false, 'Username/email, password, dan jenis pengguna wajib diisi.', [], 422);
}

if (strlen($identifier) > 150) {
    jsonResponse(false, 'Username atau email terlalu panjang.', [], 422);
}

if (strlen($passwordInput) > 4096) {
    jsonResponse(false, 'Password tidak valid.', [], 422);
}

// Pemetaan role frontend ke nama_peran di database
$roleMap = [
    'admin'           => 'Administrator',
    'administrator'   => 'Administrator',
    'petugas'         => 'Petugas Sarpras',
    'petugas sarpras' => 'Petugas Sarpras',
    'pelapor'         => 'Pelapor',
    'user'            => 'Pelapor'
];

if (!isset($roleMap[$roleInput])) {
    jsonResponse(false, 'Jenis pengguna tidak valid.', [], 422);
}

$role = $roleMap[$roleInput];

try {
    // Mencari akun pengguna berdasarkan email/username dan peran
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
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE (u.email = :identifier_email OR u.nama_pengguna = :identifier_username)
          AND p.nama_peran = :role
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':identifier_email'    => $identifier,
        ':identifier_username' => $identifier,
        ':role'                => $role
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Dummy hash untuk mencegah timing attack jika user tidak ditemukan
    $dummyHash = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
    $hashToVerify = $user ? (string) $user['kata_sandi'] : $dummyHash;
    $isPasswordValid = password_verify($passwordInput, $hashToVerify);

    if (!$user || !$isPasswordValid) {
        jsonResponse(false, 'Username/email, password, atau jenis pengguna salah.', [], 401);
    }

    // Memeriksa status keaktifan akun
    if (strcasecmp(trim((string) $user['status_akun']), 'Aktif') !== 0) {
        jsonResponse(false, 'Akun Anda tidak aktif. Hubungi Administrator.', [], 403);
    }

    // Memeriksa format email pengguna
    if (empty($user['email']) || !filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
        jsonResponse(false, 'Alamat email akun tidak valid.', [], 422);
    }

    // Memeriksa apakah email sudah terverifikasi saat registrasi
    if (empty($user['email_terverifikasi_pada'])) {
        jsonResponse(
            false,
            'Email akun Anda belum diverifikasi. Silakan selesaikan verifikasi email terlebih dahulu.',
            [
                'requires_email_verification' => true,
                'email'                       => $user['email'],
                'redirect'                    => 'verifikasi.html'
            ],
            403
        );
    }

    // Membersihkan sisa session lama dan regenerasi ID session
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
        jsonResponse(false, 'Gagal membuat sesi login.', [], 500);
    }

    // Membuat OTP baru dan mengambil ID OTP secara atomik
    $pdo->beginTransaction();

    $otp = OtpService::create($pdo, (int) $user['id_pengguna'], 'Login');

    $otpQuery = $pdo->prepare("
        SELECT id_otp, UNIX_TIMESTAMP(berlaku_sampai) AS expires_at
        FROM otp_verifikasi
        WHERE id_pengguna = :id_pengguna
          AND tujuan = :tujuan
          AND digunakan_pada IS NULL
          AND dibatalkan_pada IS NULL
        ORDER BY id_otp DESC
        LIMIT 1
    ");
    $otpQuery->execute([
        ':id_pengguna' => (int) $user['id_pengguna'],
        ':tujuan'      => 'Login'
    ]);
    $otpRecord = $otpQuery->fetch(PDO::FETCH_ASSOC);

    if (!$otpRecord) {
        $pdo->rollBack();
        jsonResponse(false, 'Gagal menyiapkan kode verifikasi.', [], 500);
    }

    $pdo->commit();

    // Mengirim OTP ke email pengguna
    $emailSent = MailService::sendOtp((string) $user['email'], $otp, 'Login');

    if (!$emailSent) {
        OtpService::cancel($pdo, (int) $user['id_pengguna'], 'Login');
        jsonResponse(false, 'Gagal mengirim kode OTP. Silakan coba kembali.', [], 500);
    }

    // Menyimpan identitas sementara ke session untuk tahap verifikasi OTP
    $_SESSION['pending_login'] = [
        'id_pengguna'   => (int) $user['id_pengguna'],
        'id_peran'      => (int) $user['id_peran'],
        'nama_lengkap'  => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email'         => $user['email'],
        'nama_peran'    => $user['nama_peran']
    ];
    $_SESSION['login_id_otp'] = (string) $otpRecord['id_otp'];
    $_SESSION['pending_login_expires'] = time() + 900;

    // Menyamarkan alamat email untuk ditampilkan di UI
    $emailParts  = explode('@', (string) $user['email'], 2);
    $emailPrefix = $emailParts[0];
    $emailDomain = $emailParts[1] ?? '';
    $maskedEmail = substr($emailPrefix, 0, 2)
        . str_repeat('*', max(1, strlen($emailPrefix) - 2))
        . '@' . $emailDomain;

    jsonResponse(true, 'Kode OTP berhasil dikirim ke email Anda.', [
        'requires_otp' => true,
        'email'        => $maskedEmail,
        'role'         => $user['nama_peran'],
        'redirect'     => 'verifikasi.html'
    ], 200);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[SIPFAS LOGIN ERROR] ' . $e->getMessage());
    jsonResponse(false, 'Terjadi kesalahan saat memproses login.', [], 500);
}