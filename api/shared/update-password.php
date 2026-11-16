//update-pasword.php
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

// Membaca input JSON atau form POST
$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

$passwordLama = (string)($input['oldPassword'] ?? $input['old_password'] ?? $input['password_lama'] ?? '');
$passwordBaru = (string)($input['newPassword'] ?? $input['new_password'] ?? $input['password_baru'] ?? '');
$konfirmasi   = (string)($input['confirmPassword'] ?? $input['confirm_password'] ?? $input['konfirmasi_password'] ?? $passwordBaru);

// Validasi input password
if ($passwordLama === '' || $passwordBaru === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Password lama dan password baru wajib diisi.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (
    strlen($passwordBaru) < 8 ||
    strlen($passwordBaru) > 72 ||
    !preg_match('/[A-Z]/', $passwordBaru) ||
    !preg_match('/[a-z]/', $passwordBaru) ||
    !preg_match('/[0-9]/', $passwordBaru)
) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Password baru minimal 8 karakter serta mengandung huruf besar, huruf kecil, dan angka.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($passwordBaru !== $konfirmasi) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Konfirmasi password baru tidak sesuai.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Mengambil hash kata sandi saat ini dari tabel pengguna
    $stmt = $pdo->prepare("SELECT kata_sandi FROM pengguna WHERE id_pengguna = :id LIMIT 1");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Akun pengguna tidak ditemukan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Memverifikasi kecocokan password lama
    if (!password_verify($passwordLama, (string)$user['kata_sandi'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Password lama tidak sesuai.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Mencegah penggunaan ulang password yang sama
    if (password_verify($passwordBaru, (string)$user['kata_sandi'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Password baru tidak boleh sama dengan password lama.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Menyimpan hash password baru ke kolom kata_sandi
    $newHash = password_hash($passwordBaru, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE pengguna SET kata_sandi = :hash WHERE id_pengguna = :id")
        ->execute([':hash' => $newHash, ':id' => $userId]);

    echo json_encode([
        'success' => true,
        'message' => 'Password berhasil diperbarui.',
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[SIPFAS UPDATE PASSWORD ERROR] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal memperbarui password: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}