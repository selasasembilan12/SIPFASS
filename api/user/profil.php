<?php
declare(strict_types=1);

/**
 * =========================================================
 * SIPFAS - API PROFIL PELAPOR
 * =========================================================
 * GET  : Mengambil profil pengguna.
 * POST : Memperbarui profil, password, dan foto.
 *
 * Sumber data: DATABASE + PHP SESSION
 * =========================================================
 */

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

function profilResponse(
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
// 1. MEMERIKSA SESSION LOGIN
// =========================================================

$userSession = $_SESSION['user'] ?? null;

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true ||
    !is_array($userSession)
) {
    profilResponse(
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.',
        [],
        401
    );
}

$idPengguna = (int) ($userSession['id_pengguna'] ?? 0);

if ($idPengguna <= 0) {
    profilResponse(
        false,
        'Identitas pengguna tidak valid.',
        [],
        401
    );
}

// =========================================================
// 2. MENGAMBIL DATA PENGGUNA DARI DATABASE
// =========================================================

function ambilProfilDatabase(PDO $pdo, int $idPengguna): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nomor_identitas,
            u.nama_pengguna,
            u.email,
            u.unit_kerja,
            u.foto_profil,
            u.status_akun,
            u.email_terverifikasi_pada,
            u.kata_sandi,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id_pengguna
        LIMIT 1
    ");

    $stmt->execute([
        ':id_pengguna' => $idPengguna
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

// =========================================================
// 3. MENYIAPKAN DATA PROFIL UNTUK RESPONS
// =========================================================

function formatProfil(array $user): array
{
    return [
        'id' => (string) $user['id_pengguna'],
        'id_pengguna' => (string) $user['id_pengguna'],
        'name' => (string) $user['nama_lengkap'],
        'nama_lengkap' => (string) $user['nama_lengkap'],
        'nim' => (string) ($user['nomor_identitas'] ?? ''),
        'nomor_identitas' => (string) ($user['nomor_identitas'] ?? ''),
        'username' => (string) $user['nama_pengguna'],
        'email' => (string) $user['email'],
        'unit_kerja' => (string) ($user['unit_kerja'] ?? ''),
        'photo' => $user['foto_profil'],
        'foto_profil' => $user['foto_profil'],
        'role' => (string) $user['nama_peran'],
        'status_akun' => (string) $user['status_akun'],
        'email_terverifikasi' =>
            $user['email_terverifikasi_pada'] !== null
    ];
}

// =========================================================
// 4. MEMERIKSA AKUN DAN ROLE
// =========================================================

try {

    $user = ambilProfilDatabase($pdo, $idPengguna);

    if (!$user) {
        profilResponse(
            false,
            'Data pengguna tidak ditemukan.',
            [],
            404
        );
    }

    if (
        strcasecmp(trim((string) $user['status_akun']), 'Aktif') !== 0
    ) {
        profilResponse(
            false,
            'Akun tidak aktif. Hubungi Administrator.',
            [],
            403
        );
    }

    if (
        strcasecmp(trim((string) $user['nama_peran']), 'Pelapor') !== 0
    ) {
        profilResponse(
            false,
            'Akses ditolak. API ini khusus untuk Pelapor.',
            [],
            403
        );
    }

    // Menyegarkan session dari database.
    $_SESSION['user'] = [
        'id_pengguna' => (int) $user['id_pengguna'],
        'id_peran' => (int) $user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nomor_identitas' => $user['nomor_identitas'],
        'unit_kerja' => $user['unit_kerja'],
        'foto_profil' => $user['foto_profil'],
        'nama_peran' => $user['nama_peran']
    ];

    // =====================================================
    // 5. REQUEST GET - MENGAMBIL PROFIL
    // =====================================================

    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'GET') {
        profilResponse(
            true,
            'Data profil berhasil diambil.',
            formatProfil($user)
        );
    }

    // =====================================================
    // 6. REQUEST POST - MEMPERBARUI PROFIL
    // =====================================================

    if ($method !== 'POST') {
        header('Allow: GET, POST');

        profilResponse(
            false,
            'Metode permintaan tidak diizinkan.',
            [],
            405
        );
    }

    // Pastikan permintaan berasal dari FormData.
    $contentType = strtolower(
        trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
    );

    if ($contentType !== 'multipart/form-data') {
        profilResponse(
            false,
            'Format permintaan harus multipart/form-data.',
            [],
            415
        );
    }

    // =====================================================
    // 7. VALIDASI INPUT
    // =====================================================

    $nama = trim((string) ($_POST['nama'] ?? ''));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));

    $passwordLama = (string) ($_POST['password-current'] ?? '');
    $passwordBaru = (string) ($_POST['password-new'] ?? '');
    $passwordKonfirmasi = (string) ($_POST['password-confirm'] ?? '');

    if (mb_strlen($nama) < 3 || mb_strlen($nama) > 150) {
        profilResponse(
            false,
            'Nama lengkap harus terdiri dari 3 sampai 150 karakter.',
            [],
            422
        );
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        profilResponse(
            false,
            'Format email tidak valid.',
            [],
            422
        );
    }

    // =====================================================
    // 8. MEMERIKSA EMAIL DUPLIKAT
    // =====================================================

    $stmt = $pdo->prepare("
        SELECT id_pengguna
        FROM pengguna
        WHERE email = :email
        AND id_pengguna <> :id_pengguna
        LIMIT 1
    ");

    $stmt->execute([
        ':email' => $email,
        ':id_pengguna' => $idPengguna
    ]);

    if ($stmt->fetchColumn()) {
        profilResponse(
            false,
            'Email tersebut sudah digunakan akun lain.',
            [],
            409
        );
    }

    // =====================================================
    // 9. VALIDASI PERGANTIAN PASSWORD
    // =====================================================

    $inginGantiPassword = (
        $passwordLama !== '' ||
        $passwordBaru !== '' ||
        $passwordKonfirmasi !== ''
    );

    $passwordHashBaru = null;

    if ($inginGantiPassword) {

        if (
            $passwordLama === '' ||
            $passwordBaru === '' ||
            $passwordKonfirmasi === ''
        ) {
            profilResponse(
                false,
                'Semua kolom penggantian kata sandi wajib diisi.',
                [],
                422
            );
        }

        if (!password_verify(
            $passwordLama,
            (string) $user['kata_sandi']
        )) {
            profilResponse(
                false,
                'Kata sandi saat ini tidak sesuai.',
                [],
                422
            );
        }

        if (
            strlen($passwordBaru) < 8 ||
            strlen($passwordBaru) > 72 ||
            !preg_match('/[A-Z]/', $passwordBaru) ||
            !preg_match('/[a-z]/', $passwordBaru) ||
            !preg_match('/[0-9]/', $passwordBaru)
        ) {
            profilResponse(
                false,
                'Kata sandi baru minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.',
                [],
                422
            );
        }

        if ($passwordBaru !== $passwordKonfirmasi) {
            profilResponse(
                false,
                'Konfirmasi kata sandi tidak sesuai.',
                [],
                422
            );
        }

        if (password_verify(
            $passwordBaru,
            (string) $user['kata_sandi']
        )) {
            profilResponse(
                false,
                'Kata sandi baru harus berbeda dari kata sandi saat ini.',
                [],
                422
            );
        }

        $passwordHashBaru = password_hash(
            $passwordBaru,
            PASSWORD_DEFAULT
        );
    }

    // =====================================================
    // 10. MEMPROSES UPLOAD FOTO
    // =====================================================

    $fotoBaru = null;
    $fileFotoBaru = null;

    if (
        isset($_FILES['foto_profil']) &&
        $_FILES['foto_profil']['error'] !== UPLOAD_ERR_NO_FILE
    ) {
        $file = $_FILES['foto_profil'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            profilResponse(
                false,
                'Upload foto gagal. Kode error: ' . $file['error'],
                [],
                422
            );
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            profilResponse(
                false,
                'Ukuran foto maksimal 5 MB.',
                [],
                422
            );
        }

        if (!is_uploaded_file($file['tmp_name'])) {
            profilResponse(
                false,
                'File foto tidak valid.',
                [],
                422
            );
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);

        $allowedTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp'
        ];

        if (!isset($allowedTypes[$mime])) {
            profilResponse(
                false,
                'Format foto hanya boleh JPG, PNG, atau WEBP.',
                [],
                422
            );
        }

        if (@getimagesize($file['tmp_name']) === false) {
            profilResponse(
                false,
                'File bukan gambar yang valid.',
                [],
                422
            );
        }

        $uploadDirectory = dirname(__DIR__, 2) . '/uploads/profil';

        if (
            !is_dir($uploadDirectory) &&
            !mkdir($uploadDirectory, 0755, true) &&
            !is_dir($uploadDirectory)
        ) {
            throw new RuntimeException(
                'Direktori upload tidak dapat dibuat.'
            );
        }

        $fileName = bin2hex(random_bytes(16)) .
            '.' . $allowedTypes[$mime];

        $destination = $uploadDirectory . '/' . $fileName;

        if (!move_uploaded_file(
            $file['tmp_name'],
            $destination
        )) {
            throw new RuntimeException(
                'Gagal memindahkan foto ke direktori upload.'
            );
        }

        $fotoBaru = 'uploads/profil/' . $fileName;
        $fileFotoBaru = $destination;
    }

    // =====================================================
    // 11. MENYIMPAN PERUBAHAN KE DATABASE
    // =====================================================

    try {

        $pdo->beginTransaction();

        $sql = "
            UPDATE pengguna
            SET
                nama_lengkap = :nama,
                email = :email
        ";

        $params = [
            ':nama' => $nama,
            ':email' => $email,
            ':id_pengguna' => $idPengguna
        ];

        // Email berubah: verifikasi email harus diulang.
        if ($email !== strtolower((string) $user['email'])) {
            $sql .= ", email_terverifikasi_pada = NULL";
        }

        if ($passwordHashBaru !== null) {
            $sql .= ", kata_sandi = :kata_sandi";
            $params[':kata_sandi'] = $passwordHashBaru;
        }

        if ($fotoBaru !== null) {
            $sql .= ", foto_profil = :foto_profil";
            $params[':foto_profil'] = $fotoBaru;
        }

        $sql .= " WHERE id_pengguna = :id_pengguna";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $pdo->commit();

    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($fileFotoBaru && is_file($fileFotoBaru)) {
            @unlink($fileFotoBaru);
        }

        throw $e;
    }

    // =====================================================
    // 12. MENGAMBIL DATA TERBARU
    // =====================================================

    $userTerbaru = ambilProfilDatabase($pdo, $idPengguna);

    if (!$userTerbaru) {
        throw new RuntimeException(
            'Gagal membaca profil setelah pembaruan.'
        );
    }

    // Sinkronisasi session.
    $_SESSION['user'] = [
        'id_pengguna' => (int) $userTerbaru['id_pengguna'],
        'id_peran' => (int) $userTerbaru['id_peran'],
        'nama_lengkap' => $userTerbaru['nama_lengkap'],
        'nama_pengguna' => $userTerbaru['nama_pengguna'],
        'email' => $userTerbaru['email'],
        'nomor_identitas' => $userTerbaru['nomor_identitas'],
        'unit_kerja' => $userTerbaru['unit_kerja'],
        'foto_profil' => $userTerbaru['foto_profil'],
        'nama_peran' => $userTerbaru['nama_peran']
    ];

    $_SESSION['sipfas_user'] = $_SESSION['user'];
    $_SESSION['nama_lengkap'] = $userTerbaru['nama_lengkap'];

    profilResponse(
        true,
        'Perubahan profil berhasil disimpan.',
        formatProfil($userTerbaru)
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS PROFIL API] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    profilResponse(
        false,
        'Terjadi kesalahan saat memproses profil. Silakan periksa log server.',
        [],
        500
    );
}
