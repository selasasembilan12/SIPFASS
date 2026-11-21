<?php
declare(strict_types=1);


require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function updateResponse(
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

// ---------------------------------------------------------
// 1. VALIDASI REQUEST
// ---------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    updateResponse(
        false,
        'Metode permintaan tidak diizinkan.',
        [],
        405
    );
}

// ---------------------------------------------------------
// 2. VALIDASI SESSION
// ---------------------------------------------------------

if (
    ($_SESSION['login_terverifikasi'] ?? false) !== true
) {
    updateResponse(
        false,
        'Sesi login tidak ditemukan. Silakan login kembali.',
        [],
        401
    );
}

$idPengguna = (string) ($_SESSION['id_pengguna'] ?? '');

if (!ctype_digit($idPengguna) || $idPengguna === '0') {
    updateResponse(
        false,
        'Identitas pengguna tidak valid.',
        [],
        401
    );
}

// ---------------------------------------------------------
// 3. MEMBACA INPUT
// ---------------------------------------------------------

$contentType = strtolower(
    trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
);

if ($contentType === 'multipart/form-data') {
    $input = $_POST;
} elseif ($contentType === 'application/json') {
    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        updateResponse(false, 'Format JSON tidak valid.', [], 400);
    }
} else {
    updateResponse(
        false,
        'Gunakan JSON atau multipart/form-data.',
        [],
        415
    );
}

// ---------------------------------------------------------
// 4. VALIDASI INPUT PROFIL
// ---------------------------------------------------------

$nama = trim((string) ($input['nama_lengkap'] ?? ''));
$email = strtolower(trim((string) ($input['email'] ?? '')));

if (mb_strlen($nama) < 3 || mb_strlen($nama) > 150) {
    updateResponse(
        false,
        'Nama lengkap harus terdiri dari 3–150 karakter.',
        [],
        422
    );
}

if (
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($email) > 150
) {
    updateResponse(
        false,
        'Alamat email tidak valid.',
        [],
        422
    );
}

// ---------------------------------------------------------
// 5. VALIDASI PERGANTIAN PASSWORD
// ---------------------------------------------------------

$passwordLama = (string) ($input['password_lama'] ?? '');
$passwordBaru = (string) ($input['password_baru'] ?? '');
$konfirmasi = (string) ($input['konfirmasi_password'] ?? '');

$inginGantiPassword = (
    $passwordLama !== '' ||
    $passwordBaru !== '' ||
    $konfirmasi !== ''
);

if ($inginGantiPassword) {

    if (
        $passwordLama === '' ||
        $passwordBaru === '' ||
        $konfirmasi === ''
    ) {
        updateResponse(
            false,
            'Lengkapi seluruh kolom pergantian kata sandi.',
            [],
            422
        );
    }

    if (strlen($passwordBaru) < 8 || strlen($passwordBaru) > 4096) {
        updateResponse(
            false,
            'Kata sandi baru minimal 8 karakter.',
            [],
            422
        );
    }

    if (!preg_match('/[A-Z]/', $passwordBaru) ||
        !preg_match('/[a-z]/', $passwordBaru) ||
        !preg_match('/[0-9]/', $passwordBaru)
    ) {
        updateResponse(
            false,
            'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka.',
            [],
            422
        );
    }

    if ($passwordBaru !== $konfirmasi) {
        updateResponse(
            false,
            'Konfirmasi kata sandi tidak sesuai.',
            [],
            422
        );
    }
}

// ---------------------------------------------------------
// 6. VALIDASI FOTO PROFIL
// ---------------------------------------------------------

$root = dirname(__DIR__, 2);
$uploadDir = $root . '/uploads/profil';

$fotoBaru = null;
$fotoPath = null;

if (
    isset($_FILES['foto_profil']) &&
    $_FILES['foto_profil']['error'] !== UPLOAD_ERR_NO_FILE
) {
    $file = $_FILES['foto_profil'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        updateResponse(false, 'Upload foto gagal.', [], 422);
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        updateResponse(
            false,
            'Ukuran foto maksimal 5 MB.',
            [],
            422
        );
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp'
    ];

    if (
        !isset($allowed[$mime]) ||
        @getimagesize($file['tmp_name']) === false
    ) {
        updateResponse(
            false,
            'Format foto harus JPG, PNG, atau WEBP.',
            [],
            422
        );
    }

    if (!is_dir($uploadDir) &&
        !mkdir($uploadDir, 0755, true) &&
        !is_dir($uploadDir)
    ) {
        updateResponse(
            false,
            'Folder penyimpanan foto tidak dapat dibuat.',
            [],
            500
        );
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];

    $fotoPath = $uploadDir . '/' . $filename;
    $fotoBaru = 'uploads/profil/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $fotoPath)) {
        updateResponse(
            false,
            'Foto gagal disimpan ke server.',
            [],
            500
        );
    }
}

// ---------------------------------------------------------
// 7. MEMPROSES UPDATE DATABASE
// ---------------------------------------------------------

try {

    $pdo->beginTransaction();

    // Mengunci data pengguna yang sedang login.
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.email,
            u.kata_sandi,
            u.foto_profil,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p
            ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = ?
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([$idPengguna]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new RuntimeException('Akun pengguna tidak ditemukan.');
    }

    if (strcasecmp(trim($user['status_akun']), 'Aktif') !== 0) {
        throw new RuntimeException('Akun pengguna tidak aktif.');
    }

    if (strcasecmp(trim($user['nama_peran']), 'Pelapor') !== 0) {
        throw new RuntimeException('API ini khusus untuk Pelapor.');
    }

    // Memeriksa email agar tidak digunakan akun lain.
    $checkEmail = $pdo->prepare("
        SELECT id_pengguna
        FROM pengguna
        WHERE email = ?
        AND id_pengguna <> ?
        LIMIT 1
    ");

    $checkEmail->execute([$email, $idPengguna]);

    if ($checkEmail->fetch()) {
        throw new DomainException('Email sudah digunakan akun lain.');
    }

    // Memeriksa password lama apabila ingin mengganti password.
    if ($inginGantiPassword) {

        if (!password_verify($passwordLama, $user['kata_sandi'])) {
            throw new DomainException(
                'Kata sandi saat ini tidak sesuai.'
            );
        }

        if (password_verify($passwordBaru, $user['kata_sandi'])) {
            throw new DomainException(
                'Kata sandi baru harus berbeda dari kata sandi lama.'
            );
        }
    }

    $emailBerubah = (
        strtolower($user['email']) !== $email
    );

    // Menyusun perubahan berdasarkan data yang benar-benar berubah.
    $sql = "
        UPDATE pengguna
        SET
            nama_lengkap = :nama,
            email = :email
    ";

    $params = [
        ':nama' => $nama,
        ':email' => $email,
        ':id' => $idPengguna
    ];

    if ($emailBerubah) {
        // Email baru perlu diverifikasi kembali.
        $sql .= ", email_terverifikasi_pada = NULL";
    }

    if ($inginGantiPassword) {
        $sql .= ", kata_sandi = :password";
        $params[':password'] = password_hash(
            $passwordBaru,
            PASSWORD_DEFAULT
        );
    }

    if ($fotoBaru !== null) {
        $sql .= ", foto_profil = :foto";
        $params[':foto'] = $fotoBaru;
    }

    $sql .= "
        WHERE id_pengguna = :id
        LIMIT 1
    ";

    $update = $pdo->prepare($sql);
    $update->execute($params);

    $pdo->commit();

    // Mengambil data terbaru dari database.
    $read = $pdo->prepare("
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
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p
            ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = ?
        LIMIT 1
    ");

    $read->execute([$idPengguna]);
    $updatedUser = $read->fetch(PDO::FETCH_ASSOC);

    // Memperbarui identitas session agar konsisten.
    $_SESSION['id_peran'] = $updatedUser['id_peran'];
    $_SESSION['nama_peran'] = $updatedUser['nama_peran'];
    $_SESSION['nama_lengkap'] = $updatedUser['nama_lengkap'];

    $_SESSION['sipfas_user'] = $updatedUser;

    // Menghapus foto lama jika foto baru berhasil disimpan.
    if ($fotoBaru !== null && !empty($user['foto_profil'])) {
        $oldPath = $root . '/' . ltrim($user['foto_profil'], '/');
        $realOldPath = realpath($oldPath);
        $realUploadDir = realpath($uploadDir);

        if (
            $realOldPath &&
            $realUploadDir &&
            str_starts_with(
                $realOldPath,
                $realUploadDir . DIRECTORY_SEPARATOR
            ) &&
            is_file($realOldPath)
        ) {
            @unlink($realOldPath);
        }
    }

    updateResponse(
        true,
        'Profil berhasil diperbarui.',
        [
            'id_pengguna' => (string) $updatedUser['id_pengguna'],
            'nama_lengkap' => $updatedUser['nama_lengkap'],
            'nomor_identitas' => $updatedUser['nomor_identitas'],
            'nama_pengguna' => $updatedUser['nama_pengguna'],
            'email' => $updatedUser['email'],
            'unit_kerja' => $updatedUser['unit_kerja'],
            'foto_profil' => $updatedUser['foto_profil'],
            'role' => $updatedUser['nama_peran'],
            'email_terverifikasi' =>
                $updatedUser['email_terverifikasi_pada'] !== null
        ]
    );

} catch (DomainException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($fotoPath && is_file($fotoPath)) {
        @unlink($fotoPath);
    }

    updateResponse(false, $e->getMessage(), [], 422);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($fotoPath && is_file($fotoPath)) {
        @unlink($fotoPath);
    }

    error_log(
        '[SIPFAS UPDATE PROFILE] ' .
        get_class($e) . ': ' . $e->getMessage()
    );

    $status = $e instanceof RuntimeException ? 403 : 500;

    updateResponse(
        false,
        $e instanceof RuntimeException
            ? $e->getMessage()
            : 'Terjadi kesalahan saat memperbarui profil.',
        [],
        $status
    );
}
