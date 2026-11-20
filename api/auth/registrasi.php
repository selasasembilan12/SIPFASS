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
function registerResponse(
    bool $success,
    string $message,
    array $data = [],
    int $statusCode = 200
): never {
    http_response_code($statusCode);
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
    registerResponse(false, 'Metode permintaan tidak diizinkan.', [], 405);
}

// Memastikan koneksi PDO tersedia
if (!isset($pdo) || !($pdo instanceof PDO)) {
    error_log('[SIPFAS REGISTRASI] Koneksi PDO tidak tersedia.');
    registerResponse(false, 'Koneksi database tidak tersedia.', [], 500);
}

// Membaca input JSON atau form POST
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

// Mengambil dan menormalisasi data formulir
$namaLengkap        = trim(preg_replace('/\s+/', ' ', (string) ($input['fullName'] ?? '')));
$nomorIdentitas     = trim((string) ($input['nim'] ?? ''));
$namaPengguna       = strtolower(trim((string) ($input['username'] ?? '')));
$email              = strtolower(trim((string) ($input['email'] ?? '')));
$password           = (string) ($input['password'] ?? '');
$konfirmasiPassword = (string) ($input['confirmPassword'] ?? '');

// Validasi nama lengkap
if (mb_strlen($namaLengkap, 'UTF-8') < 3 || mb_strlen($namaLengkap, 'UTF-8') > 150) {
    registerResponse(false, 'Nama lengkap harus terdiri dari 3 sampai 150 karakter.', [], 422);
}

// Validasi NIM / nomor identitas
if (!preg_match('/^[0-9]{5,20}$/', $nomorIdentitas)) {
    registerResponse(false, 'NIM harus berupa angka dengan panjang 5 sampai 20 digit.', [], 422);
}

// Validasi username
if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/', $namaPengguna)) {
    registerResponse(false, 'Username harus terdiri dari 3 sampai 30 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).', [], 422);
}

// Validasi email
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
    registerResponse(false, 'Alamat email tidak valid.', [], 422);
}

// Validasi kekuatan password
if (
    strlen($password) < 8 ||
    strlen($password) > 72 ||
    !preg_match('/[A-Z]/', $password) ||
    !preg_match('/[a-z]/', $password) ||
    !preg_match('/[0-9]/', $password)
) {
    registerResponse(false, 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.', [], 422);
}

// Validasi kesesuaian konfirmasi password
if ($password !== $konfirmasiPassword) {
    registerResponse(false, 'Konfirmasi password tidak sesuai.', [], 422);
}

try {
    $pdo->beginTransaction();

    // Mengambil ID peran Pelapor dari database
    $roleStmt = $pdo->prepare("SELECT id_peran FROM peran WHERE nama_peran = :role LIMIT 1");
    $roleStmt->execute([':role' => 'Pelapor']);
    $role = $roleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$role) {
        $pdo->rollBack();
        registerResponse(false, 'Role Pelapor belum tersedia di database.', [], 500);
    }

    // Memeriksa duplikasi NIM, username, atau email
    $checkStmt = $pdo->prepare("
        SELECT nomor_identitas, nama_pengguna, email
        FROM pengguna
        WHERE nomor_identitas = :nim
           OR nama_pengguna = :username
           OR email = :email
        LIMIT 1
    ");
    $checkStmt->execute([
        ':nim'      => $nomorIdentitas,
        ':username' => $namaPengguna,
        ':email'    => $email
    ]);
    $duplicate = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ($duplicate) {
        $pdo->rollBack();

        if ((string) $duplicate['nomor_identitas'] === $nomorIdentitas) {
            registerResponse(false, 'NIM sudah terdaftar.', [], 409);
        }
        if (strcasecmp((string) $duplicate['nama_pengguna'], $namaPengguna) === 0) {
            registerResponse(false, 'Username sudah digunakan.', [], 409);
        }
        if (strcasecmp((string) $duplicate['email'], $email) === 0) {
            registerResponse(false, 'Email sudah terdaftar.', [], 409);
        }

        registerResponse(false, 'Data akun sudah digunakan.', [], 409);
    }

    // Mengenkripsi password sebelum disimpan
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        throw new RuntimeException('Gagal mengamankan password.');
    }

    // Menyimpan akun baru ke tabel pengguna
    $insertStmt = $pdo->prepare("
        INSERT INTO pengguna (
            id_peran,
            nama_lengkap,
            nomor_identitas,
            nama_pengguna,
            email,
            kata_sandi,
            status_akun,
            email_terverifikasi_pada,
            dibuat_oleh
        ) VALUES (
            :id_peran,
            :nama_lengkap,
            :nomor_identitas,
            :nama_pengguna,
            :email,
            :kata_sandi,
            'Aktif',
            NULL,
            NULL
        )
    ");
    $insertStmt->execute([
        ':id_peran'        => (int) $role['id_peran'],
        ':nama_lengkap'    => $namaLengkap,
        ':nomor_identitas' => $nomorIdentitas,
        ':nama_pengguna'   => $namaPengguna,
        ':email'           => $email,
        ':kata_sandi'      => $passwordHash
    ]);

    $idPengguna = (int) $pdo->lastInsertId();
    $pdo->commit();

    // Membuat dan mengirim OTP verifikasi email
    $otp = OtpService::create($pdo, $idPengguna, 'VerifikasiEmail');
    $emailSent = MailService::sendOtp($email, $otp, 'VerifikasiEmail');

    // Menyimpan sesi sementara verifikasi registrasi
    $_SESSION['pending_verification'] = [
        'id_pengguna' => $idPengguna,
        'email'       => $email,
        'tujuan'      => 'VerifikasiEmail',
        'expires_at'  => time() + 900
    ];

    if (!$emailSent) {
        OtpService::cancel($pdo, $idPengguna, 'VerifikasiEmail');
        error_log('[SIPFAS] Akun ' . $idPengguna . ' berhasil dibuat, tetapi OTP gagal dikirim.');

        registerResponse(
            true,
            'Akun berhasil dibuat, tetapi OTP gagal dikirim. Silakan minta kirim ulang OTP atau hubungi administrator.',
            [
                'id_pengguna'                 => $idPengguna,
                'email'                       => $email,
                'email_sent'                  => false,
                'requires_email_verification' => true
            ],
            201
        );
    }

    registerResponse(true, 'Registrasi berhasil. Kode OTP telah dikirim ke email Anda.', [
        'id_pengguna'                 => $idPengguna,
        'nama_lengkap'                => $namaLengkap,
        'email'                       => $email,
        'role'                        => 'Pelapor',
        'email_sent'                  => true,
        'requires_email_verification' => true,
        'redirect'                    => 'verifikasi.html'
    ], 201);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[SIPFAS REGISTRASI PDO] ' . $e->getMessage());

    if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
        registerResponse(false, 'NIM, username, atau email sudah terdaftar.', [], 409);
    }
    registerResponse(false, 'Terjadi kesalahan database saat registrasi.', [], 500);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[SIPFAS REGISTRASI ERROR] ' . $e->getMessage());
    registerResponse(false, 'Terjadi kesalahan pada server. Silakan coba kembali.', [], 500);
}