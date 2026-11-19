<?php
declare(strict_types=1);
//revisi akhir
// Memuat konfigurasi session dan koneksi database.
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

date_default_timezone_set('Asia/Jayapura');

// Mengirim respons JSON.
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

try {

    // 01. Memastikan metode request POST.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');

        perbaruiProfilResponse(
            405,
            false,
            'Metode permintaan tidak diizinkan.'
        );
    }

    // 02. Memeriksa session pengguna.
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

    // 03. Memastikan akun aktif dan memiliki hak akses.
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

    // 04. Memvalidasi format request.
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

    // 05. Mengambil data profil.
    $namaLengkap = trim((string) (
        $input['nama_lengkap'] ?? ''
    ));

    $namaPengguna = trim((string) (
        $input['nama_pengguna'] ?? ''
    ));

    $email = trim((string) (
        $input['email'] ?? ''
    ));

    $currentPassword = (string) (
        $input['current_password'] ?? ''
    );

    $newPassword = (string) (
        $input['new_password'] ?? ''
    );

    $photoData = $input['foto_data_url'] ?? null;

    // 06. Memvalidasi nama lengkap.
    if (
        $namaLengkap === '' ||
        mb_strlen($namaLengkap) > 150
    ) {
        perbaruiProfilResponse(
            422,
            false,
            'Nama lengkap wajib diisi dan maksimal 150 karakter.'
        );
    }

    // 07. Memvalidasi username.
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

    // 08. Memvalidasi email.
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

    // 09. Memeriksa username agar tidak digunakan akun lain.
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

    // 10. Memeriksa email agar tidak digunakan akun lain.
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

    // 11. Memeriksa apakah pengguna meminta perubahan kata sandi.
    $passwordRequested = (
        $currentPassword !== '' ||
        $newPassword !== ''
    );

    $passwordHash = null;

    if ($passwordRequested) {

        // Kata sandi lama dan baru wajib diisi bersamaan.
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

        // Memastikan kata sandi lama benar.
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

        // Memvalidasi kata sandi baru.
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

        // Menghasilkan hash kata sandi baru.
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

    // 12. Menyiapkan direktori penyimpanan foto.
    $projectRoot = dirname(__DIR__, 2);

    $uploadDirectory = $projectRoot . '/uploads/profil';

    if (
        !is_dir($uploadDirectory) &&
        !mkdir($uploadDirectory, 0755, true) &&
        !is_dir($uploadDirectory)
    ) {
        throw new RuntimeException(
            'Direktori penyimpanan foto gagal dibuat.'
        );
    }

    // 13. Memvalidasi dan menyimpan foto profil baru.
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
                '/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=\r\n]+)$/',
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

        // Memastikan isi file benar-benar gambar.
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

        if (!isset($allowedImages[$mime])) {
            perbaruiProfilResponse(
                422,
                false,
                'Format gambar tidak didukung.'
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

        // Menghasilkan nama file unik.
        $fileName = bin2hex(random_bytes(16))
            . '.'
            . $allowedImages[$mime];

        $absolutePath = $uploadDirectory . '/' . $fileName;

        // Menulis file foto baru.
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

    // 14. Menyimpan perubahan dalam transaksi database.
    $pdo->beginTransaction();

    // Mengunci data akun sebelum pembaruan.
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

    // Memastikan kata sandi tidak berubah sejak pemeriksaan awal.
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

    // Memastikan username tetap unik.
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

    // Memastikan email tetap unik.
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

    // 15. Menyusun query sesuai permintaan perubahan kata sandi.
    if ($passwordRequested) {

        $updateSql = "
            UPDATE pengguna
            SET
                nama_lengkap = :nama,
                nama_pengguna = :username,
                email = :email,
                foto_profil = COALESCE(
                    :foto,
                    foto_profil
                ),
                kata_sandi = :password
            WHERE id_pengguna = :id
        ";

        $updateParams = [
            ':nama' => $namaLengkap,
            ':username' => $namaPengguna,
            ':email' => $email,
            ':foto' => $newPhotoPath,
            ':password' => $passwordHash,
            ':id' => $userId
        ];

    } else {

        // Kata sandi tidak disentuh ketika tidak diminta.
        $updateSql = "
            UPDATE pengguna
            SET
                nama_lengkap = :nama,
                nama_pengguna = :username,
                email = :email,
                foto_profil = COALESCE(
                    :foto,
                    foto_profil
                )
            WHERE id_pengguna = :id
        ";

        $updateParams = [
            ':nama' => $namaLengkap,
            ':username' => $namaPengguna,
            ':email' => $email,
            ':foto' => $newPhotoPath,
            ':id' => $userId
        ];
    }

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute($updateParams);

    // 16. Mengambil data terbaru dari database.
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

    // 17. Menyelesaikan transaksi.
    $pdo->commit();

    // Menghapus foto lama setelah transaksi berhasil.
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

    // 18. Menyusun profil terbaru.
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

    // 19. Menyinkronkan session dengan database.
    $_SESSION['id_pengguna'] = $profile['id_pengguna'];
    $_SESSION['id_peran'] = $profile['id_peran'];
    $_SESSION['nama_lengkap'] = $profile['nama_lengkap'];
    $_SESSION['nama_peran'] = $profile['nama_peran'];

    if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
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

    // 20. Mengirim hasil pembaruan.
    perbaruiProfilResponse(
        200,
        true,
        $passwordRequested
            ? 'Profil dan kata sandi berhasil diperbarui.'
            : 'Profil berhasil diperbarui.',
        $profile
    );

} catch (Throwable $e) {

    // Membatalkan transaksi jika terjadi kesalahan.
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // Menghapus foto baru apabila penyimpanan database gagal.
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
