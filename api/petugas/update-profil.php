<?php
declare(strict_types=1);


require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

function perbaruiProfilResponse(
    int $status,
    bool $success,
    string $message,
    ?array $user = null
): never {
    http_response_code($status);

    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
        'data' => $user
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

    exit;
}

$newPhotoPath = null;
$projectRoot = dirname(__DIR__, 2);
$uploadDirectory = $projectRoot . '/uploads/profil';

try {

    // ==================================================
    // 01. VALIDASI METODE REQUEST
    // ==================================================

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');

        perbaruiProfilResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // ==================================================
    // 02. VALIDASI SESSION PENGGUNA
    // ==================================================

    $userId = (int) (
        $_SESSION['id_pengguna']
        ?? $_SESSION['user']['id_pengguna']
        ?? $_SESSION['sipfas_user']['id_pengguna']
        ?? 0
    );

    if (
        $userId <= 0 ||
        ($_SESSION['login_terverifikasi'] ?? false) !== true
    ) {
        perbaruiProfilResponse(
            401,
            false,
            'Sesi login tidak ditemukan. Silakan login kembali.'
        );
    }

    // ==================================================
    // 03. MENGAMBIL DATA PENGGUNA
    // ==================================================

    $userStmt = $pdo->prepare("
        SELECT
            u.id_pengguna,
            u.id_peran,
            u.nama_lengkap,
            u.nomor_identitas,
            u.nama_pengguna,
            u.email,
            u.kata_sandi,
            u.unit_kerja,
            u.foto_profil,
            u.status_akun,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $userStmt->execute([
        ':id' => $userId
    ]);

    $currentUser = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentUser) {
        perbaruiProfilResponse(
            404,
            false,
            'Data pengguna tidak ditemukan.'
        );
    }

    // Memastikan akun aktif.
    if (
        strcasecmp(
            (string) $currentUser['status_akun'],
            'Aktif'
        ) !== 0
    ) {
        perbaruiProfilResponse(
            403,
            false,
            'Akun pengguna tidak aktif.'
        );
    }

    // Memastikan hak akses.
    if (
        !in_array(
            (string) $currentUser['nama_peran'],
            ['Petugas Sarpras', 'Administrator'],
            true
        )
    ) {
        perbaruiProfilResponse(
            403,
            false,
            'Anda tidak memiliki akses memperbarui profil petugas.'
        );
    }

    // ==================================================
    // 04. MEMBACA REQUEST JSON
    // ==================================================

    $contentType = strtolower(
        trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
    );

    if ($contentType !== 'application/json') {
        perbaruiProfilResponse(
            415,
            false,
            'Gunakan format JSON.'
        );
    }

    $raw = file_get_contents('php://input');

    if (
        $raw === false ||
        strlen($raw) > 8 * 1024 * 1024
    ) {
        perbaruiProfilResponse(
            413,
            false,
            'Ukuran data permintaan melebihi batas.'
        );
    }

    $input = json_decode($raw, true);

    if (!is_array($input)) {
        perbaruiProfilResponse(
            400,
            false,
            'Format data JSON tidak valid.'
        );
    }

    // ==================================================
    // 05. MENGAMBIL DATA PROFIL SECARA OPSIONAL
    // ==================================================

    // Kolom yang tidak dikirim atau kosong akan
    // mempertahankan nilai sebelumnya dari database.

    $namaLengkap = trim((string) (
        $input['nama_lengkap'] ?? ''
    ));

    $namaPengguna = trim((string) (
        $input['nama_pengguna'] ?? ''
    ));

    $email = trim((string) (
        $input['email'] ?? ''
    ));

    if ($namaLengkap === '') {
        $namaLengkap = (string) $currentUser['nama_lengkap'];
    }

    if ($namaPengguna === '') {
        $namaPengguna = (string) $currentUser['nama_pengguna'];
    }

    if ($email === '') {
        $email = (string) $currentUser['email'];
    }

    $currentPassword = (string) (
        $input['current_password'] ?? ''
    );

    $newPassword = (string) (
        $input['new_password'] ?? ''
    );

    $photoData = $input['foto_data_url'] ?? null;

    // ==================================================
    // 06. VALIDASI NAMA LENGKAP
    // ==================================================

    if (
        $namaLengkap === '' ||
        mb_strlen($namaLengkap) > 150
    ) {
        perbaruiProfilResponse(
            422,
            false,
            'Nama lengkap maksimal 150 karakter dan tidak boleh kosong.'
        );
    }

    // ==================================================
    // 07. VALIDASI USERNAME
    // ==================================================

    if (
        $namaPengguna === '' ||
        mb_strlen($namaPengguna) > 50 ||
        !preg_match(
            '/^[a-zA-Z0-9_.-]+$/',
            $namaPengguna
        )
    ) {
        perbaruiProfilResponse(
            422,
            false,
            'Username tidak valid. Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.'
        );
    }

    // ==================================================
    // 08. VALIDASI EMAIL
    // ==================================================

    if (
        $email === '' ||
        mb_strlen($email) > 150 ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {
        perbaruiProfilResponse(
            422,
            false,
            'Alamat email tidak valid.'
        );
    }

    // ==================================================
    // 09. PEMERIKSAAN USERNAME UNIK
    // ==================================================

    if (
        $namaPengguna !==
        (string) $currentUser['nama_pengguna']
    ) {
        $usernameStmt = $pdo->prepare("
            SELECT id_pengguna
            FROM pengguna
            WHERE nama_pengguna = :username
              AND id_pengguna <> :id
            LIMIT 1
        ");

        $usernameStmt->execute([
            ':username' => $namaPengguna,
            ':id' => $userId
        ]);

        if ($usernameStmt->fetchColumn()) {
            perbaruiProfilResponse(
                409,
                false,
                'Username sudah digunakan oleh pengguna lain.'
            );
        }
    }

    // ==================================================
    // 10. PEMERIKSAAN EMAIL UNIK
    // ==================================================

    if (
        $email !==
        (string) $currentUser['email']
    ) {
        $emailStmt = $pdo->prepare("
            SELECT id_pengguna
            FROM pengguna
            WHERE email = :email
              AND id_pengguna <> :id
            LIMIT 1
        ");

        $emailStmt->execute([
            ':email' => $email,
            ':id' => $userId
        ]);

        if ($emailStmt->fetchColumn()) {
            perbaruiProfilResponse(
                409,
                false,
                'Email sudah digunakan oleh pengguna lain.'
            );
        }
    }

    // ==================================================
    // 11. VALIDASI PASSWORD OPSIONAL
    // ==================================================

    $passwordRequested = (
        $currentPassword !== '' ||
        $newPassword !== ''
    );

    $passwordHash = null;

    if ($passwordRequested) {

        if (
            $currentPassword === '' ||
            $newPassword === ''
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Untuk mengganti kata sandi, isi kata sandi lama dan kata sandi baru.'
            );
        }

        if (
            !password_verify(
                $currentPassword,
                (string) $currentUser['kata_sandi']
            )
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Kata sandi lama tidak sesuai.'
            );
        }

        if (
            strlen($newPassword) < 8 ||
            strlen($newPassword) > 72 ||
            !preg_match('/[A-Za-z]/', $newPassword) ||
            !preg_match('/[0-9]/', $newPassword)
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Kata sandi baru minimal 8 karakter dan harus mengandung huruf serta angka.'
            );
        }

        if ($currentPassword === $newPassword) {
            perbaruiProfilResponse(
                422,
                false,
                'Kata sandi baru harus berbeda dari kata sandi lama.'
            );
        }

        $passwordHash = password_hash(
            $newPassword,
            PASSWORD_DEFAULT
        );

        if ($passwordHash === false) {
            throw new RuntimeException(
                'Gagal menghasilkan hash kata sandi.'
            );
        }
    }

    // ==================================================
    // 12. MENYIAPKAN DIREKTORI FOTO
    // ==================================================

    if (
        !is_dir($uploadDirectory) &&
        !mkdir($uploadDirectory, 0755, true) &&
        !is_dir($uploadDirectory)
    ) {
        throw new RuntimeException(
            'Direktori penyimpanan foto gagal dibuat.'
        );
    }

    // ==================================================
    // 13. VALIDASI DAN PENYIMPANAN FOTO
    // ==================================================

    if ($photoData !== null && $photoData !== '') {

        if (!is_string($photoData)) {
            perbaruiProfilResponse(
                422,
                false,
                'Format foto profil tidak valid.'
            );
        }

        if (
            !preg_match(
                '~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$~D',
                $photoData,
                $matches
            )
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Foto harus berformat JPG, PNG, atau WebP.'
            );
        }

        $imageData = base64_decode(
            $matches[2],
            true
        );

        if (
            $imageData === false ||
            strlen($imageData) === 0 ||
            strlen($imageData) > 5 * 1024 * 1024
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Ukuran foto tidak valid atau melebihi 5 MB.'
            );
        }

        // Memastikan file benar-benar gambar.
        $imageInfo = getimagesizefromstring($imageData);

        if ($imageInfo === false) {
            perbaruiProfilResponse(
                422,
                false,
                'File yang diunggah bukan gambar yang valid.'
            );
        }

        $mime = $imageInfo['mime'] ?? '';

        $allowedImages = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp'
        ];

        if (
            !isset($allowedImages[$mime]) ||
            $mime !== 'image/' . $matches[1]
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Format gambar tidak sesuai dengan isi file.'
            );
        }

        if (
            $imageInfo[0] > 5000 ||
            $imageInfo[1] > 5000
        ) {
            perbaruiProfilResponse(
                422,
                false,
                'Dimensi foto terlalu besar.'
            );
        }

        $fileName = bin2hex(random_bytes(16))
            . '.'
            . $allowedImages[$mime];

        $absolutePath = $uploadDirectory . '/' . $fileName;

        $written = file_put_contents(
            $absolutePath,
            $imageData,
            LOCK_EX
        );

        if ($written === false) {
            throw new RuntimeException(
                'Foto profil gagal disimpan.'
            );
        }

        $newPhotoPath = 'uploads/profil/' . $fileName;
    }

    // ==================================================
    // 14. MEMULAI TRANSAKSI DATABASE
    // ==================================================

    $pdo->beginTransaction();

    // Mengunci data pengguna.
    $lockStmt = $pdo->prepare("
        SELECT
            id_pengguna,
            foto_profil,
            kata_sandi,
            status_akun
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
        FOR UPDATE
    ");

    $lockStmt->execute([
        ':id' => $userId
    ]);

    $lockedUser = $lockStmt->fetch(PDO::FETCH_ASSOC);

    if (
        !$lockedUser ||
        strcasecmp(
            (string) $lockedUser['status_akun'],
            'Aktif'
        ) !== 0
    ) {
        throw new RuntimeException(
            'Akun tidak tersedia atau sudah tidak aktif.'
        );
    }

    // Memastikan password tidak berubah.
    if (
        !hash_equals(
            (string) $currentUser['kata_sandi'],
            (string) $lockedUser['kata_sandi']
        )
    ) {
        throw new RuntimeException(
            'Data kata sandi berubah. Silakan muat ulang profil.'
        );
    }

    // ==================================================
    // 15. MEMERIKSA KEUNIKAN KEMBALI
    // ==================================================

    if (
        $namaPengguna !==
        (string) $currentUser['nama_pengguna']
    ) {
        $checkUsername = $pdo->prepare("
            SELECT id_pengguna
            FROM pengguna
            WHERE nama_pengguna = :username
              AND id_pengguna <> :id
            LIMIT 1
        ");

        $checkUsername->execute([
            ':username' => $namaPengguna,
            ':id' => $userId
        ]);

        if ($checkUsername->fetchColumn()) {
            throw new RuntimeException(
                'Username sudah digunakan pengguna lain.'
            );
        }
    }

    if (
        $email !==
        (string) $currentUser['email']
    ) {
        $checkEmail = $pdo->prepare("
            SELECT id_pengguna
            FROM pengguna
            WHERE email = :email
              AND id_pengguna <> :id
            LIMIT 1
        ");

        $checkEmail->execute([
            ':email' => $email,
            ':id' => $userId
        ]);

        if ($checkEmail->fetchColumn()) {
            throw new RuntimeException(
                'Email sudah digunakan pengguna lain.'
            );
        }
    }

    // ==================================================
    // 16. UPDATE HANYA KOLOM YANG BERUBAH
    // ==================================================

    $setParts = [];

    $updateParams = [
        ':id' => $userId
    ];

    if (
        $namaLengkap !==
        (string) $currentUser['nama_lengkap']
    ) {
        $setParts[] = 'nama_lengkap = :nama';
        $updateParams[':nama'] = $namaLengkap;
    }

    if (
        $namaPengguna !==
        (string) $currentUser['nama_pengguna']
    ) {
        $setParts[] = 'nama_pengguna = :username';
        $updateParams[':username'] = $namaPengguna;
    }

    if (
        $email !==
        (string) $currentUser['email']
    ) {
        $setParts[] = 'email = :email';
        $updateParams[':email'] = $email;
    }

    if ($newPhotoPath !== null) {
        $setParts[] = 'foto_profil = :foto';
        $updateParams[':foto'] = $newPhotoPath;
    }

    if ($passwordHash !== null) {
        $setParts[] = 'kata_sandi = :password';
        $updateParams[':password'] = $passwordHash;
    }

    if (empty($setParts)) {
        throw new RuntimeException(
            'Tidak ada perubahan profil yang perlu disimpan.'
        );
    }

    $updateSql = "
        UPDATE pengguna
        SET " . implode(', ', $setParts) . "
        WHERE id_pengguna = :id
    ";

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute($updateParams);

    // ==================================================
    // 17. MENGAMBIL DATA PROFIL TERBARU
    // ==================================================

    $resultStmt = $pdo->prepare("
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
            u.tanggal_dibuat,
            u.tanggal_diperbarui,
            p.nama_peran

        FROM pengguna u

        INNER JOIN peran p
            ON p.id_peran = u.id_peran

        WHERE u.id_pengguna = :id
        LIMIT 1
    ");

    $resultStmt->execute([
        ':id' => $userId
    ]);

    $updatedUser = $resultStmt->fetch(PDO::FETCH_ASSOC);

    if (!$updatedUser) {
        throw new RuntimeException(
            'Profil terbaru gagal dibaca.'
        );
    }

    // ==================================================
    // 18. COMMIT TRANSAKSI
    // ==================================================

    $pdo->commit();

    // ==================================================
    // 19. MENGHAPUS FOTO LAMA SETELAH COMMIT
    // ==================================================

    $oldPhoto = $lockedUser['foto_profil'] ?? '';

    if (
        $newPhotoPath !== null &&
        is_string($oldPhoto) &&
        str_starts_with($oldPhoto, 'uploads/profil/')
    ) {
        $oldAbsolutePath = $projectRoot . '/' . $oldPhoto;

        if (
            is_file($oldAbsolutePath) &&
            realpath(dirname($oldAbsolutePath)) ===
                realpath($uploadDirectory)
        ) {
            @unlink($oldAbsolutePath);
        }
    }

    // ==================================================
    // 20. MENYUSUN DATA PROFIL
    // ==================================================

    $profile = [
        'id_pengguna' => (int) $updatedUser['id_pengguna'],
        'id_peran' => (int) $updatedUser['id_peran'],

        'nama_lengkap' => $updatedUser['nama_lengkap'],
        'nomor_identitas' => $updatedUser['nomor_identitas'],

        'nama_pengguna' => $updatedUser['nama_pengguna'],
        'email' => $updatedUser['email'],

        'unit_kerja' => $updatedUser['unit_kerja'],
        'foto_profil' => $updatedUser['foto_profil'],

        'status_akun' => $updatedUser['status_akun'],
        'nama_peran' => $updatedUser['nama_peran'],

        'tanggal_dibuat' => $updatedUser['tanggal_dibuat'],
        'tanggal_diperbarui' => $updatedUser['tanggal_diperbarui']
    ];

    // ==================================================
    // 21. MENYINKRONKAN PHP SESSION
    // ==================================================

    $_SESSION['id_pengguna'] = $profile['id_pengguna'];
    $_SESSION['id_peran'] = $profile['id_peran'];
    $_SESSION['nama_lengkap'] = $profile['nama_lengkap'];
    $_SESSION['nama_peran'] = $profile['nama_peran'];

    if (
        isset($_SESSION['user']) &&
        is_array($_SESSION['user'])
    ) {
        $_SESSION['user'] = array_merge(
            $_SESSION['user'],
            $profile
        );
    }

    if (
        isset($_SESSION['sipfas_user']) &&
        is_array($_SESSION['sipfas_user'])
    ) {
        $_SESSION['sipfas_user'] = array_merge(
            $_SESSION['sipfas_user'],
            $profile
        );
    }

    // ==================================================
    // 22. MENGIRIM RESPONS BERHASIL
    // ==================================================

    perbaruiProfilResponse(
        200,
        true,
        $passwordRequested
            ? 'Profil dan kata sandi berhasil diperbarui.'
            : 'Profil berhasil diperbarui.',
        $profile
    );

} catch (Throwable $e) {

    // ==================================================
    // 23. ROLLBACK JIKA TERJADI KEGAGALAN
    // ==================================================

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // Menghapus foto baru jika transaksi gagal.
    if (
        $newPhotoPath !== null &&
        isset($projectRoot, $uploadDirectory)
    ) {
        $newAbsolutePath = $projectRoot . '/' . $newPhotoPath;

        if (
            is_file($newAbsolutePath) &&
            realpath(dirname($newAbsolutePath)) ===
                realpath($uploadDirectory)
        ) {
            @unlink($newAbsolutePath);
        }
    }

    error_log(
        '[SIPFAS PERBARUI PROFIL ERROR] ' .
        get_class($e) . ': ' .
        $e->getMessage()
    );

    perbaruiProfilResponse(
        500,
        false,
        'Gagal memperbarui profil. Periksa PHP error log.'
    );
}
