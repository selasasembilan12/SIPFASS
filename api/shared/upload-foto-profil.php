<?php
declare(strict_types=1);


// Mencegah warning PHP tampil sebagai HTML dalam respons API.
ini_set('display_errors', '0');
error_reporting(E_ALL);

ob_start();

/* ==================================================
   01. KONFIGURASI SISTEM
================================================== */

require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/role-check.php';
// Perlindungan CSRF: wajib token valid untuk POST/PUT/PATCH/DELETE.
require_once dirname(_DIR_, 2) . '/config/csrf.php';
sipfas_csrf_require_valid();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

/* ==================================================
   02. RESPONSE JSON
================================================== */

function upload_photo_response(
    bool $success,
    string $message,
    int $status = 200,
    array $data = []
): never {

    if (ob_get_level() > 0) {
        ob_clean();
    }

    http_response_code($status);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'foto_profil' => $data['foto_profil'] ?? null,
            'data' => $data
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

/* ==================================================
   03. VALIDASI METODE REQUEST
================================================== */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    header('Allow: POST');

    upload_photo_response(
        false,
        'Metode permintaan harus POST.',
        405
    );
}

/* ==================================================
   04. VALIDASI SESSION PENGGUNA
================================================== */

// Menggunakan sumber session yang sama dengan sistem SIPFAS.
$sessionUser = sipfas_session_user();

$userId = (int)(
    $sessionUser['id_pengguna'] ?? 0
);

if ($userId <= 0) {

    upload_photo_response(
        false,
        'Sesi login tidak valid. Silakan login kembali.',
        401
    );
}

/* ==================================================
   05. VALIDASI FILE FOTO
================================================== */

$file = $_FILES['foto_profil']
    ?? $_FILES['photo']
    ?? $_FILES['avatar']
    ?? null;

if (!$file) {

    upload_photo_response(
        false,
        'File foto profil wajib dipilih.',
        400
    );
}

$uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);

if ($uploadError !== UPLOAD_ERR_OK) {

    $errors = [
        UPLOAD_ERR_INI_SIZE =>
            'Ukuran foto melebihi batas upload server.',

        UPLOAD_ERR_FORM_SIZE =>
            'Ukuran foto melebihi batas formulir.',

        UPLOAD_ERR_PARTIAL =>
            'Foto hanya berhasil diunggah sebagian.',

        UPLOAD_ERR_NO_FILE =>
            'File foto profil wajib dipilih.',

        UPLOAD_ERR_NO_TMP_DIR =>
            'Folder sementara upload tidak tersedia.',

        UPLOAD_ERR_CANT_WRITE =>
            'Server gagal menulis file foto.',

        UPLOAD_ERR_EXTENSION =>
            'Upload foto dihentikan oleh konfigurasi server.'
    ];

    upload_photo_response(
        false,
        $errors[$uploadError] ?? 'Terjadi kesalahan saat mengunggah foto.',
        400
    );
}

/* ==================================================
   06. VALIDASI UKURAN
================================================== */

$maxSize = 2 * 1024 * 1024;

if ((int)$file['size'] <= 0 || (int)$file['size'] > $maxSize) {

    upload_photo_response(
        false,
        'Ukuran foto harus lebih dari 0 dan maksimal 2 MB.',
        422
    );
}

/* ==================================================
   07. VALIDASI MIME FOTO
================================================== */

if (
    !isset($file['tmp_name']) ||
    !is_uploaded_file($file['tmp_name'])
) {

    upload_photo_response(
        false,
        'File upload tidak valid.',
        422
    );
}

try {

    $finfo = new finfo(FILEINFO_MIME_TYPE);

    $mime = $finfo->file($file['tmp_name']);

    $allowedMimes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp'
    ];

    if (!isset($allowedMimes[$mime])) {

        upload_photo_response(
            false,
            'Format foto harus JPG, PNG, atau WEBP.',
            422
        );
    }

    // Memastikan file benar-benar merupakan gambar.
    $imageInfo = getimagesize($file['tmp_name']);

    if ($imageInfo === false) {

        upload_photo_response(
            false,
            'File yang diunggah bukan gambar yang valid.',
            422
        );
    }

    /* ==============================================
       08. KONFIGURASI FOLDER UPLOAD
    ============================================== */

    $rootDir = dirname(__DIR__, 2);

    $uploadDir = $rootDir . '/uploads/profil/';

    if (
        !is_dir($uploadDir) &&
        !mkdir($uploadDir, 0775, true) &&
        !is_dir($uploadDir)
    ) {

        upload_photo_response(
            false,
            'Folder penyimpanan foto gagal dibuat.',
            500
        );
    }

    if (!is_writable($uploadDir)) {

        upload_photo_response(
            false,
            'Folder penyimpanan foto tidak memiliki izin tulis.',
            500
        );
    }

    /* ==============================================
       09. MENGAMBIL FOTO LAMA
    ============================================== */

    $stmt = $pdo->prepare("
        SELECT foto_profil
        FROM pengguna
        WHERE id_pengguna = :id
        LIMIT 1
    ");

    $stmt->execute([
        ':id' => $userId
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {

        upload_photo_response(
            false,
            'Akun pengguna tidak ditemukan.',
            404
        );
    }

    $oldPhoto = (string)($user['foto_profil'] ?? '');

    /* ==============================================
       10. MEMBUAT NAMA FILE UNIK
    ============================================== */

    $extension = $allowedMimes[$mime];

    $fileName = 'profil_' .
        $userId . '_' .
        bin2hex(random_bytes(8)) .
        '.' . $extension;

    $relativePath = 'uploads/profil/' . $fileName;

    $targetPath = $uploadDir . $fileName;

    /* ==============================================
       11. MEMINDAHKAN FILE FOTO
    ============================================== */

    if (!move_uploaded_file(
        $file['tmp_name'],
        $targetPath
    )) {

        upload_photo_response(
            false,
            'Gagal menyimpan file foto ke server.',
            500
        );
    }

    /* ==============================================
       12. MEMPERBARUI DATABASE
    ============================================== */

    try {

        $pdo->beginTransaction();

        $update = $pdo->prepare("
            UPDATE pengguna
            SET foto_profil = :foto
            WHERE id_pengguna = :id
        ");

        $update->execute([
            ':foto' => $relativePath,
            ':id' => $userId
        ]);

        if ($update->rowCount() < 0) {
            throw new RuntimeException(
                'Gagal memperbarui foto profil.'
            );
        }

        $pdo->commit();

    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        // Hapus foto baru jika penyimpanan database gagal.
        if (is_file($targetPath)) {
            @unlink($targetPath);
        }

        throw $e;
    }

    /* ==============================================
       13. MEMPERBARUI SESSION
    ============================================== */

    if (
        isset($_SESSION['user']) &&
        is_array($_SESSION['user'])
    ) {

        $_SESSION['user']['foto_profil'] = $relativePath;
    }

    /* ==============================================
       14. MENGHAPUS FOTO LAMA
    ============================================== */

    if (
        $oldPhoto !== '' &&
        $oldPhoto !== $relativePath &&
        str_starts_with($oldPhoto, 'uploads/profil/')
    ) {

        $oldFileName = basename($oldPhoto);

        $oldFullPath = $uploadDir . $oldFileName;

        if (
            is_file($oldFullPath) &&
            realpath(dirname($oldFullPath)) === realpath($uploadDir)
        ) {

            @unlink($oldFullPath);
        }
    }

    /* ==============================================
       15. RESPONSE BERHASIL
    ============================================== */

    upload_photo_response(
        true,
        'Foto profil berhasil diperbarui.',
        200,
        [
            'foto_profil' => $relativePath,
            'id_pengguna' => $userId
        ]
    );

} catch (Throwable $e) {

    error_log(
        '[SIPFAS UPLOAD FOTO ERROR] ' .
        $e->getMessage()
    );

    upload_photo_response(
        false,
        'Terjadi kesalahan saat mengunggah foto profil. Periksa log PHP.',
        500
    );
}
