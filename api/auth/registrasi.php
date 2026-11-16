
<?php

/**
 * =========================================================
 * SIPFAS - REGISTRASI AKUN
 * =========================================================
 *
 * Fungsi:
 * 1. Menerima data registrasi dari frontend.
 * 2. Memvalidasi seluruh data pengguna.
 * 3. Memeriksa duplikasi NIM, username, dan email.
 * 4. Mengambil role Pelapor dari database.
 * 5. Menyimpan akun ke tabel pengguna.
 * 6. Membuat OTP verifikasi email.
 * 7. Mengirim OTP menggunakan Gmail SMTP.
 *
 * =========================================================
 */


// =========================================================
// 01. MEMANGGIL KONFIGURASI DAN SERVICE
// =========================================================

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

require_once dirname(__DIR__, 2) . '/services/OtpService.php';

require_once dirname(__DIR__, 2) . '/services/MailService.php';


// =========================================================
// 02. PENGATURAN RESPONS
// =========================================================

header('Content-Type: application/json; charset=utf-8');

header('Cache-Control: no-store, no-cache, must-revalidate');

header('Pragma: no-cache');


// =========================================================
// 03. FUNGSI RESPONS JSON
// =========================================================

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

        'data' => $data

    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}


// =========================================================
// 04. MEMERIKSA METODE REQUEST
// =========================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    header('Allow: POST');

    registerResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );

}


// =========================================================
// 05. MEMERIKSA KONEKSI DATABASE
// =========================================================

if (!isset($pdo) || !($pdo instanceof PDO)) {

    error_log('[SIPFAS REGISTRASI] Koneksi PDO tidak tersedia.');

    registerResponse(
        false,
        'Koneksi database tidak tersedia.',
        [],
        500
    );

}


// =========================================================
// 06. MEMBACA INPUT FRONTEND
// =========================================================

$rawInput = file_get_contents('php://input');

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    $input = $_POST;
}


// Mengambil data formulir.

$namaLengkap = trim(
    (string) ($input['fullName'] ?? '')
);

$nomorIdentitas = trim(
    (string) ($input['nim'] ?? '')
);

$namaPengguna = strtolower(trim(
    (string) ($input['username'] ?? '')
));

$email = strtolower(trim(
    (string) ($input['email'] ?? '')
));

$password = (string) ($input['password'] ?? '');

$konfirmasiPassword = (string) (
    $input['confirmPassword'] ?? ''
);


// =========================================================
// 07. VALIDASI DATA REGISTRASI
// =========================================================

// Validasi nama lengkap.

if (
    mb_strlen($namaLengkap, 'UTF-8') < 3 ||
    mb_strlen($namaLengkap, 'UTF-8') > 150
) {

    registerResponse(
        false,
        'Nama lengkap harus terdiri dari 3 sampai 150 karakter.',
        [],
        422
    );

}


// Validasi NIM.

if (!preg_match('/^[0-9]{5,20}$/', $nomorIdentitas)) {

    registerResponse(
        false,
        'NIM harus berupa angka dengan panjang 5 sampai 20 digit.',
        [],
        422
    );

}


// Validasi username.

if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/', $namaPengguna)) {

    registerResponse(
        false,
        'Username harus terdiri dari 3 sampai 30 karakter.',
        [],
        422
    );

}


// Validasi email.

if (
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($email) > 150
) {

    registerResponse(
        false,
        'Alamat email tidak valid.',
        [],
        422
    );

}


// Validasi password.

if (
    strlen($password) < 8 ||
    strlen($password) > 72 ||
    !preg_match('/[A-Z]/', $password) ||
    !preg_match('/[a-z]/', $password) ||
    !preg_match('/[0-9]/', $password)
) {

    registerResponse(
        false,
        'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.',
        [],
        422
    );

}


// Validasi konfirmasi password.

if ($password !== $konfirmasiPassword) {

    registerResponse(
        false,
        'Konfirmasi password tidak sesuai.',
        [],
        422
    );

}


// =========================================================
// 08. MEMPROSES PENDAFTARAN KE DATABASE
// =========================================================

try {

    // -----------------------------------------------------
    // A. MEMULAI TRANSAKSI
    // -----------------------------------------------------

    $pdo->beginTransaction();


    // -----------------------------------------------------
    // B. MENGAMBIL ROLE PELAPOR
    // -----------------------------------------------------

    $roleStmt = $pdo->prepare("

        SELECT id_peran

        FROM peran

        WHERE nama_peran = :role

        LIMIT 1

    ");

    $roleStmt->execute([

        ':role' => 'Pelapor'

    ]);

    $role = $roleStmt->fetch(PDO::FETCH_ASSOC);


    if (!$role) {

        $pdo->rollBack();

        registerResponse(
            false,
            'Role Pelapor belum tersedia di database.',
            [],
            500
        );

    }


    // -----------------------------------------------------
    // C. MEMERIKSA DUPLIKASI DATA
    // -----------------------------------------------------

    $checkSql = "

        SELECT
            nomor_identitas,
            nama_pengguna,
            email

        FROM pengguna

        WHERE
            nomor_identitas = :nim
            OR nama_pengguna = :username
            OR email = :email

        LIMIT 1

    ";

    $checkStmt = $pdo->prepare($checkSql);

    $checkStmt->execute([

        ':nim' => $nomorIdentitas,

        ':username' => $namaPengguna,

        ':email' => $email

    ]);

    $duplicate = $checkStmt->fetch(PDO::FETCH_ASSOC);


    if ($duplicate) {

        $pdo->rollBack();

        if (
            (string) $duplicate['nomor_identitas']
            === $nomorIdentitas
        ) {

            registerResponse(
                false,
                'NIM sudah terdaftar.',
                [],
                409
            );

        }

        if (
            strcasecmp(
                (string) $duplicate['nama_pengguna'],
                $namaPengguna
            ) === 0
        ) {

            registerResponse(
                false,
                'Username sudah digunakan.',
                [],
                409
            );

        }

        if (
            strcasecmp(
                (string) $duplicate['email'],
                $email
            ) === 0
        ) {

            registerResponse(
                false,
                'Email sudah terdaftar.',
                [],
                409
            );

        }

        registerResponse(
            false,
            'Data akun sudah digunakan.',
            [],
            409
        );

    }


    // -----------------------------------------------------
    // D. MENGAMANKAN PASSWORD
    // -----------------------------------------------------

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {

        throw new RuntimeException(
            'Gagal mengamankan password.'
        );

    }


    // -----------------------------------------------------
    // E. MENYIMPAN DATA PENGGUNA
    // -----------------------------------------------------

    $insertSql = "

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

        )

        VALUES (

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

    ";

    $insertStmt = $pdo->prepare($insertSql);

    $insertStmt->execute([

        ':id_peran' => (int) $role['id_peran'],

        ':nama_lengkap' => $namaLengkap,

        ':nomor_identitas' => $nomorIdentitas,

        ':nama_pengguna' => $namaPengguna,

        ':email' => $email,

        ':kata_sandi' => $passwordHash

    ]);


    // Mengambil ID pengguna baru.

    $idPengguna = (int) $pdo->lastInsertId();


    // -----------------------------------------------------
    // F. MENYELESAIKAN TRANSAKSI
    // -----------------------------------------------------

    $pdo->commit();


    // =====================================================
    // 09. MEMBUAT OTP VERIFIKASI EMAIL
    // =====================================================

    $otp = OtpService::create(

        $pdo,

        $idPengguna,

        'VerifikasiEmail'

    );


    // =====================================================
    // 10. MENGIRIM OTP MELALUI GMAIL
    // =====================================================

    $emailSent = MailService::sendOtp(

        $email,

        $otp,

        'VerifikasiEmail'

    );


    // -----------------------------------------------------
    // 11. MENANGANI KEGAGALAN PENGIRIMAN EMAIL
    // -----------------------------------------------------

    if (!$emailSent) {

        // Membatalkan OTP yang gagal dikirim.
        OtpService::cancel(
            $pdo,
            $idPengguna,
            'VerifikasiEmail'
        );

        error_log(
            '[SIPFAS] Akun ' . $idPengguna .
            ' berhasil dibuat, tetapi OTP gagal dikirim.'
        );

        registerResponse(

            true,

            'Akun berhasil dibuat, tetapi OTP gagal dikirim. Silakan hubungi administrator.',

            [

                'id_pengguna' => $idPengguna,

                'email' => $email,

                'email_sent' => false,

                'requires_email_verification' => true

            ],

            201

        );

    }


    // =====================================================
    // 12. RESPONS KEBERHASILAN
    // =====================================================

    registerResponse(

        true,

        'Registrasi berhasil. Kode OTP telah dikirim ke email Anda.',

        [

            'id_pengguna' => $idPengguna,

            'nama_lengkap' => $namaLengkap,

            'email' => $email,

            'role' => 'Pelapor',

            'email_sent' => true,

            'requires_email_verification' => true

        ],

        201

    );


} catch (PDOException $e) {

    // Membatalkan transaksi apabila masih aktif.

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS REGISTRASI PDO] ' . $e->getMessage()
    );


    // Menangani data duplikat dari UNIQUE constraint.

    if ((int) ($e->errorInfo[1] ?? 0) === 1062) {

        registerResponse(
            false,
            'NIM, username, atau email sudah terdaftar.',
            [],
            409
        );

    }

    registerResponse(
        false,
        'Terjadi kesalahan database saat registrasi.',
        [],
        500
    );


} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        '[SIPFAS REGISTRASI ERROR] ' . $e->getMessage()
    );

    registerResponse(
        false,
        'Terjadi kesalahan pada server. Silakan coba kembali.',
        [],
        500
    );

}
