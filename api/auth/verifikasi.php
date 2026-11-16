<?php
declare(strict_types=1);

// 01. Memuat konfigurasi database, session, dan layanan OTP serta email.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/services/OtpService.php';
require_once dirname(__DIR__, 2) . '/services/MailService.php';

// 02. Mengatur format respons JSON dan mencegah penyimpanan respons di cache.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// 03. Mengirim respons JSON dengan status HTTP dan menghentikan proses.
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
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

// 04. Memastikan endpoint hanya menerima permintaan POST.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    verifikasiResponse(
        405,
        false,
        'Metode permintaan tidak diizinkan.'
    );
}

// 05. Membaca dan memeriksa data JSON yang dikirim oleh JavaScript.
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

$rawInput = file_get_contents('php://input', false, null, 0, 2049);
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    verifikasiResponse(
        400,
        false,
        'Data permintaan tidak valid.'
    );
}

// 06. Memeriksa jenis tindakan dan memastikan format OTP terdiri dari delapan digit.
$action = $data['action'] ?? 'verify';

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

// 07. Memastikan pengguna memiliki session login sementara yang masih berlaku.
$pending = $_SESSION['pending_login'] ?? [];

$idPengguna = (int) ($pending['id_pengguna'] ?? 0);

$pendingExpiry = (int) (
    $_SESSION['pending_login_expires'] ?? 0
);

if ($idPengguna <= 0 || !isset($_SESSION['login_id_otp'])) {
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

// 08. Mengambil data akun, memeriksa OTP, dan memproses setiap tindakan verifikasi.
try {

    // A. Mengambil identitas dan status akun pengguna dari database.
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

    if (
        strcasecmp(trim((string) $user['status_akun']), 'Aktif') !== 0
    ) {
        verifikasiResponse(
            403,
            false,
            'Akun tidak aktif. Hubungi Administrator.'
        );
    }

    // B. Mengambil OTP terakhir dan mencocokkan ID-nya dengan session login.
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

    // C. Memeriksa apakah OTP belum digunakan, belum dibatalkan, dan belum kedaluwarsa.
    $active = (
        $otpRecord &&
        $otpRecord['digunakan_pada'] === null &&
        $otpRecord['dibatalkan_pada'] === null &&
        (int) $otpRecord['expires_at'] > time() &&
        (int) $otpRecord['jumlah_percobaan'] < 3
    );

    // D. Menyamarkan alamat email sebelum ditampilkan pada halaman verifikasi.
    $emailParts = explode('@', (string) $user['email'], 2);

    $prefix = $emailParts[0] ?? '';
    $domain = $emailParts[1] ?? '';

    $maskedEmail =
        substr($prefix, 0, 2) .
        str_repeat('*', max(1, strlen($prefix) - 2)) .
        '@' . $domain;

    // E. Memastikan OTP yang masih aktif sesuai dengan session login pengguna.
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

    // F. Membuat OTP baru dan mengirimkannya jika belum tersedia atau diminta ulang.
    if ($action === 'ensure' || $action === 'resend') {

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

        // Mengambil ID dan masa berlaku OTP yang baru dibuat.
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

        // Mengirim kode OTP ke email pengguna melalui MailService.
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

        // Menghubungkan ID OTP terbaru dengan session login pengguna.
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

    // G. Memastikan OTP yang dimasukkan benar-benar milik session pengguna.
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

    // H. Mencocokkan OTP yang dimasukkan dengan hash yang tersimpan di database.
    $isValid = password_verify(
        $otpInput,
        (string) $otpRecord['kode_hash']
    );

    if (!$isValid) {

        $attempts = (int) $otpRecord['jumlah_percobaan'] + 1;

        $stmt = $pdo->prepare("
            UPDATE otp_verifikasi
            SET
                jumlah_percobaan = :jumlah,
                dibatalkan_pada = CASE
                    WHEN :jumlah2 >= 3 THEN NOW()
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
                'remaining_attempts' => max(0, 3 - $attempts)
            ]
        );
    }

    // I. Menandai OTP sebagai sudah digunakan agar tidak dapat dipakai kembali.
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

    // J. Menentukan halaman Dashboard berdasarkan role pengguna.
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

    // K. Membuat session resmi setelah OTP berhasil diverifikasi.
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

    // Menghapus data login sementara setelah session resmi terbentuk.
    unset(
        $_SESSION['pending_login'],
        $_SESSION['pending_login_expires'],
        $_SESSION['login_id_otp']
    );

    // Menyimpan session sebelum mengirimkan respons ke browser.
    session_write_close();

    // L. Mengirim status keberhasilan dan alamat Dashboard sesuai role.
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

    // Mencatat detail kesalahan pada log server tanpa membocorkan informasi sensitif.
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
