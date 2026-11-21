<?php
declare(strict_types=1);

/*
 * SIPFAS - API PROFIL PENGGUNA
 * GET  : membaca profil dari database berdasarkan session.
 * POST : memperbarui nama, username, email, foto, dan/atau kata sandi.
 */

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(__DIR__, 2) . '/config/csrf.php';sipfas_csrf_require_valid();
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

function profileResponse(int $status, bool $success, string $message, ?array $user = null): never
{
    http_response_code($status);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
        'data' => $user,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function getProfileUser(PDO $pdo, int $userId): ?array
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
            r.nama_peran
        FROM pengguna u
        INNER JOIN peran r ON r.id_peran = u.id_peran
        WHERE u.id_pengguna = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    return $user ?: null;
}

function syncProfileSession(array $user): void
{
    $sessionUser = [
        'id_pengguna' => (int) $user['id_pengguna'],
        'id_peran' => (int) $user['id_peran'],
        'nama_lengkap' => $user['nama_lengkap'],
        'nama_pengguna' => $user['nama_pengguna'],
        'email' => $user['email'],
        'nomor_identitas' => $user['nomor_identitas'],
        'foto_profil' => $user['foto_profil'],
        'nama_peran' => $user['nama_peran'],
    ];

    $_SESSION['user'] = $sessionUser;
    $_SESSION['sipfas_user'] = $sessionUser;
    $_SESSION['id_pengguna'] = (int) $user['id_pengguna'];
    $_SESSION['id_peran'] = (int) $user['id_peran'];
    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
    $_SESSION['nama_peran'] = $user['nama_peran'];
}

try {
    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    if ($userId <= 0 || empty($_SESSION['login_terverifikasi'])) {
        profileResponse(401, false, 'Sesi login tidak ditemukan. Silakan login kembali.');
    }

    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = getProfileUser($pdo, $userId);
        if (!$user) {
            profileResponse(404, false, 'Data pengguna tidak ditemukan.');
        }
        if (strcasecmp((string) $user['status_akun'], 'Aktif') !== 0) {
            profileResponse(403, false, 'Akun tidak aktif. Hubungi Administrator.');
        }
        syncProfileSession($user);
        profileResponse(200, true, 'Profil pengguna berhasil dimuat.', $user);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        profileResponse(405, false, 'Metode permintaan tidak diizinkan.');
    }

    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') {
        profileResponse(415, false, 'Gunakan format JSON.');
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 2300000) {
        profileResponse(413, false, 'Ukuran data profil terlalu besar.');
    }

    $input = json_decode($raw, true);
    if (!is_array($input)) {
        profileResponse(400, false, 'Data permintaan tidak valid.');
    }

    $nama = trim((string) ($input['nama_lengkap'] ?? ''));
    $username = trim((string) ($input['nama_pengguna'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $currentPassword = (string) ($input['current_password'] ?? '');
    $newPassword = (string) ($input['new_password'] ?? '');
    $photoDataUrl = $input['foto_data_url'] ?? null;

    if (mb_strlen($nama) < 3 || mb_strlen($nama) > 100) {
        profileResponse(422, false, 'Nama lengkap harus terdiri dari 3 sampai 100 karakter.');
    }

    if (!preg_match('/^[A-Za-z0-9._-]{3,30}$/D', $username)) {
        profileResponse(422, false, 'Username harus terdiri dari 3 sampai 30 karakter.');
    }

    if (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        profileResponse(422, false, 'Format email tidak valid.');
    }

    if ($newPassword !== '') {
        if ($currentPassword === '') {
            profileResponse(422, false, 'Masukkan kata sandi saat ini.');
        }
        if (strlen($newPassword) < 8 || !preg_match('/[A-Za-z]/', $newPassword) || !preg_match('/[0-9]/', $newPassword)) {
            profileResponse(422, false, 'Kata sandi baru minimal 8 karakter dan harus mengandung huruf serta angka.');
        }
        if ($newPassword === $currentPassword) {
            profileResponse(422, false, 'Kata sandi baru harus berbeda dari kata sandi saat ini.');
        }
    }

    if ($photoDataUrl !== null && !is_string($photoDataUrl)) {
        profileResponse(422, false, 'Format foto profil tidak valid.');
    }

    $currentUserStmt = $pdo->prepare("
        SELECT id_pengguna, kata_sandi, foto_profil
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
    ");
    $currentUserStmt->execute([':id' => $userId]);
    $currentAccount = $currentUserStmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentAccount) {
        profileResponse(404, false, 'Data pengguna tidak ditemukan.');
    }

    if ($newPassword !== '' && !password_verify($currentPassword, (string) $currentAccount['kata_sandi'])) {
        profileResponse(422, false, 'Kata sandi saat ini tidak sesuai.');
    }

    $duplicateStmt = $pdo->prepare("
        SELECT id_pengguna
        FROM pengguna
        WHERE id_pengguna <> :id
          AND (LOWER(nama_pengguna) = LOWER(:username) OR LOWER(email) = LOWER(:email))
        LIMIT 1
    ");
    $duplicateStmt->execute([
        ':id' => $userId,
        ':username' => $username,
        ':email' => $email,
    ]);
    if ($duplicateStmt->fetchColumn()) {
        profileResponse(409, false, 'Username atau email sudah digunakan akun lain.');
    }

    $newPhotoRelativePath = null;
    $newPhotoAbsolutePath = null;

    if (is_string($photoDataUrl) && $photoDataUrl !== '') {
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $photoDataUrl, $matches)) {
            profileResponse(422, false, 'Foto harus berformat JPG, PNG, atau WEBP.');
        }

        $binary = base64_decode($matches[2], true);
        if ($binary === false || strlen($binary) > 1572864) {
            profileResponse(422, false, 'Ukuran foto maksimal 1,5 MB.');
        }

        $imageInfo = @getimagesizefromstring($binary);
        $mimeToExtension = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
        $actualMime = $imageInfo['mime'] ?? '';
        if (!isset($mimeToExtension[$actualMime])) {
            profileResponse(422, false, 'Isi file bukan gambar JPG, PNG, atau WEBP yang valid.');
        }

        $projectRoot = dirname(__DIR__, 2);
        $uploadDirectory = $projectRoot . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'profil';
        if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
            throw new RuntimeException('Folder penyimpanan foto tidak dapat dibuat.');
        }

        $fileName = 'user_' . $userId . '_' . bin2hex(random_bytes(12)) . '.' . $mimeToExtension[$actualMime];
        $newPhotoAbsolutePath = $uploadDirectory . DIRECTORY_SEPARATOR . $fileName;
        if (file_put_contents($newPhotoAbsolutePath, $binary, LOCK_EX) === false) {
            throw new RuntimeException('Foto profil gagal disimpan ke server.');
        }
        $newPhotoRelativePath = 'uploads/profil/' . $fileName;
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
            ':nama' => $nama,
            ':username' => $username,
            ':email' => $email,
            ':id' => $userId,
        ];

        if ($newPassword !== '') {
            $sql .= ", kata_sandi = :password";
            $params[':password'] = password_hash($newPassword, PASSWORD_DEFAULT);
        }

        if ($newPhotoRelativePath !== null) {
            $sql .= ", foto_profil = :foto";
            $params[':foto'] = $newPhotoRelativePath;
        }

        $sql .= " WHERE id_pengguna = :id LIMIT 1";

        $updateStmt = $pdo->prepare($sql);
        $updateStmt->execute($params);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($newPhotoAbsolutePath && is_file($newPhotoAbsolutePath)) {
            @unlink($newPhotoAbsolutePath);
        }
        throw $e;
    }

    $updatedUser = getProfileUser($pdo, $userId);
    if (!$updatedUser) {
        throw new RuntimeException('Profil berhasil diperbarui tetapi gagal dibaca kembali.');
    }

    syncProfileSession($updatedUser);
    session_write_close();

    profileResponse(200, true, 'Profil berhasil diperbarui.', $updatedUser);

} catch (Throwable $e) {
    error_log('[SIPFAS PROFILE API ERROR] ' . get_class($e) . ': ' . $e->getMessage());
    profileResponse(500, false, 'Terjadi kesalahan saat memproses profil. Periksa log PHP untuk detail teknis.');
}
