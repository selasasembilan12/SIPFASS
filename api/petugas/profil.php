<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function responseJson(int $status, bool $success, string $message, ?array $user = null): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
        'data' => $user
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function findProfile(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nomor_identitas,
            u.nama_pengguna,
            u.email,
            u.foto_profil,
            u.status_akun,
            p.nama_peran
        FROM pengguna u
        INNER JOIN peran p ON p.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function syncSessionProfile(array $user): void
{
    $data = [
        'id_pengguna' => (int)$user['id_pengguna'],
        'id_peran' => (int)$user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nomor_identitas' => $user['nomor_identitas'],
        'foto_profil' => $user['foto_profil'],
        'nama_peran' => $user['nama_peran']
    ];

    $_SESSION['user'] = $data;
    $_SESSION['sipfas_user'] = $data;
    $_SESSION['id_pengguna'] = (int)$user['id_pengguna'];
    $_SESSION['id_peran'] = (int)$user['id_peran'];
    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
    $_SESSION['nama_peran'] = $user['nama_peran'];
}

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Koneksi database tidak tersedia.');
    }

    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    $userId = (int)(
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    if ($userId <= 0) {
        responseJson(401, false, 'Sesi login tidak ditemukan. Silakan login kembali.');
    }

    $user = findProfile($pdo, $userId);

    if (!$user) {
        responseJson(404, false, 'Pengguna tidak ditemukan.');
    }

    if (strcasecmp(trim((string)$user['status_akun']), 'Aktif') !== 0) {
        responseJson(403, false, 'Akun tidak aktif. Hubungi Administrator.');
    }

    if ($method === 'GET') {
        syncSessionProfile($user);
        session_write_close();
        responseJson(200, true, 'Profil berhasil dimuat.', $user);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        responseJson(405, false, 'Metode permintaan tidak diizinkan.');
    }

    $raw = file_get_contents('php://input');

    if ($raw === false || strlen($raw) > 2500000) {
        responseJson(413, false, 'Ukuran permintaan terlalu besar.');
    }

    $input = json_decode($raw, true);

    if (!is_array($input)) {
        responseJson(400, false, 'Format data tidak valid.');
    }

    $name = trim((string)($input['nama_lengkap'] ?? ''));
    $username = trim((string)($input['nama_pengguna'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));

    $currentPassword = (string)($input['current_password'] ?? '');
    $newPassword = (string)($input['new_password'] ?? '');

    $photoData = $input['foto_data_url'] ?? null;

    if (mb_strlen($name) < 3 || mb_strlen($name) > 100) {
        responseJson(422, false, 'Nama lengkap harus terdiri dari 3 sampai 100 karakter.');
    }

    if (!preg_match('/^[A-Za-z0-9._-]{3,30}$/D', $username)) {
        responseJson(422, false, 'Username harus terdiri dari 3 sampai 30 karakter.');
    }

    if (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        responseJson(422, false, 'Format email tidak valid.');
    }

    // Password opsional.
    // Jika kedua kolom kosong, proses pembaruan profil tetap berjalan.

    if ($newPassword !== '') {
        if ($currentPassword === '') {
            responseJson(422, false, 'Masukkan kata sandi saat ini.');
        }

        if (
            strlen($newPassword) < 8 ||
            !preg_match('/[A-Za-z]/', $newPassword) ||
            !preg_match('/[0-9]/', $newPassword)
        ) {
            responseJson(422, false, 'Kata sandi baru minimal 8 karakter dan mengandung huruf serta angka.');
        }

        if ($newPassword === $currentPassword) {
            responseJson(422, false, 'Kata sandi baru harus berbeda dari kata sandi saat ini.');
        }
    }

    if ($newPassword !== '' && !password_verify($currentPassword, (string)$user['kata_sandi'])) {
        // kata_sandi diambil pada query khusus di bawah.
    }

    $checkPassword = $pdo->prepare("
        SELECT kata_sandi
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
    ");
    $checkPassword->execute([':id' => $userId]);
    $passwordHash = (string)$checkPassword->fetchColumn();

    if (
        $newPassword !== '' &&
        !password_verify($currentPassword, $passwordHash)
    ) {
        responseJson(422, false, 'Kata sandi saat ini tidak sesuai.');
    }

    // Memeriksa username dan email duplikat.

    $duplicate = $pdo->prepare("
        SELECT id_pengguna
        FROM pengguna
        WHERE id_pengguna <> :id
          AND (
              LOWER(nama_pengguna) = LOWER(:username)
              OR LOWER(email) = LOWER(:email)
          )
        LIMIT 1
    ");

    $duplicate->execute([
        ':id' => $userId,
        ':username' => $username,
        ':email' => $email
    ]);

    if ($duplicate->fetchColumn()) {
        responseJson(409, false, 'Username atau email sudah digunakan akun lain.');
    }

    // Memproses foto baru jika pengguna memilih foto.

    $photoPath = null;
    $photoAbsolute = null;

    if ($photoData !== null && $photoData !== '') {
        if (!is_string($photoData) || !preg_match(
            '#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#',
            $photoData,
            $matches
        )) {
            responseJson(422, false, 'Format foto harus JPG, PNG, atau WEBP.');
        }

        $binary = base64_decode($matches[2], true);

        if ($binary === false || strlen($binary) === 0 || strlen($binary) > 1572864) {
            responseJson(422, false, 'Ukuran foto maksimal 1,5 MB.');
        }

        $imageInfo = @getimagesizefromstring($binary);

        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp'
        ];

        $mime = $imageInfo['mime'] ?? '';

        if (!isset($extensions[$mime]) || $mime !== 'image/' . $matches[1]) {
            responseJson(422, false, 'Isi file bukan gambar yang valid.');
        }

        $root = dirname(__DIR__, 2);
        $uploadDirectory = $root . DIRECTORY_SEPARATOR . 'uploads'
            . DIRECTORY_SEPARATOR . 'profil';

        if (
            !is_dir($uploadDirectory) &&
            !mkdir($uploadDirectory, 0755, true) &&
            !is_dir($uploadDirectory)
        ) {
            throw new RuntimeException('Folder penyimpanan foto gagal dibuat.');
        }

        $fileName = 'user_' . $userId . '_' .
            bin2hex(random_bytes(12)) . '.' . $extensions[$mime];

        $photoAbsolute = $uploadDirectory . DIRECTORY_SEPARATOR . $fileName;

        if (file_put_contents($photoAbsolute, $binary, LOCK_EX) === false) {
            throw new RuntimeException('Foto gagal disimpan.');
        }

        $photoPath = 'uploads/profil/' . $fileName;
    }

    try {
        $pdo->beginTransaction();

        $sql = "
            UPDATE pengguna
            SET nama_lengkap = :nama,
                nama_pengguna = :username,
                email = :email
        ";

        $params = [
            ':nama' => $name,
            ':username' => $username,
            ':email' => $email,
            ':id' => $userId
        ];

        if ($newPassword !== '') {
            $sql .= ", kata_sandi = :password";
            $params[':password'] = password_hash($newPassword, PASSWORD_DEFAULT);
        }

        if ($photoPath !== null) {
            $sql .= ", foto_profil = :foto";
            $params[':foto'] = $photoPath;
        }

        $sql .= " WHERE id_pengguna = :id";

        $update = $pdo->prepare($sql);
        $update->execute($params);

        $pdo->commit();

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($photoAbsolute && is_file($photoAbsolute)) {
            @unlink($photoAbsolute);
        }

        throw $e;
    }

    $updatedUser = findProfile($pdo, $userId);

    if (!$updatedUser) {
        throw new RuntimeException('Profil gagal dibaca kembali.');
    }

    syncSessionProfile($updatedUser);
    session_write_close();

    responseJson(200, true, 'Profil berhasil diperbarui.', $updatedUser);

} catch (Throwable $e) {
    error_log(
        '[SIPFAS PROFILE API] ' .
        $e->getMessage() . ' | ' .
        $e->getFile() . ':' . $e->getLine()
    );

    responseJson(500, false, 'Terjadi kesalahan saat memproses profil. Periksa PHP error log.');
}
