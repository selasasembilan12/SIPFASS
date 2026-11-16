//upload-foto-profil.php
<?php

// Memuat konfigurasi sistem dan koneksi database
require_once dirname(__DIR__, 2) . '/config/bootstrap.php';
require_once dirname(__DIR__, 2) . '/config/koneksi.php';

// Mengatur header respons JSON
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Memastikan metode request adalah POST
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metode permintaan harus POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Memastikan pengguna sudah login
$userId = (int)($_SESSION['id_pengguna'] ?? $_SESSION['user']['id_pengguna'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Sesi login tidak valid. Silakan login kembali.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Mengambil berkas foto dari $_FILES (mendukung beberapa kemungkinan nama field input)
$file = $_FILES['foto_profil'] ?? $_FILES['photo'] ?? $_FILES['avatar'] ?? null;

if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'File foto profil wajib dipilih.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Validasi ukuran file maksimal 2 MB
if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Ukuran foto maksimal 2 MB.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Validasi tipe MIME asli file menggunakan finfo
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);
$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

if (!isset($allowedMimes[$mime])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Format foto harus JPG, PNG, atau WEBP.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Mengambil path foto lama untuk dibersihkan setelah unggahan baru berhasil
    $stmt = $pdo->prepare("SELECT foto_profil FROM pengguna WHERE id_pengguna = :id LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Akun pengguna tidak ditemukan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Menyiapkan folder penyimpanan uploads/profil di root proyek
    $rootDir   = dirname(__DIR__, 2);
    $uploadDir = $rootDir . '/uploads/profil/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $ext          = $allowedMimes[$mime];
    $fileName     = 'profil_' . $userId . '_' . time() . '.' . $ext;
    $relativePath = 'uploads/profil/' . $fileName;
    $targetPath   = $uploadDir . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal menyimpan file foto ke server.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Memperbarui kolom foto_profil pada tabel pengguna
    $pdo->prepare("UPDATE pengguna SET foto_profil = :foto WHERE id_pengguna = :id")
        ->execute([':foto' => $relativePath, ':id' => $userId]);

    // Menghapus file foto lama di server jika ada
    $oldPhoto = (string)($user['foto_profil'] ?? '');
    if ($oldPhoto !== '' && $oldPhoto !== $relativePath) {
        $oldFullPath = $rootDir . '/' . ltrim($oldPhoto, '/');
        if (is_file($oldFullPath)) {
            @unlink($oldFullPath);
        }
    }

    // Memperbarui data foto pada session aktif
    if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
        $_SESSION['user']['foto_profil'] = $relativePath;
    }

    echo json_encode([
        'success'     => true,
        'message'     => 'Foto profil berhasil diperbarui.',
        'foto_profil' => $relativePath,
        'data'        => ['foto_profil' => $relativePath],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[SIPFAS UPLOAD FOTO ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal mengunggah foto profil: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}